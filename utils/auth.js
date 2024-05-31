const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const redisClient = require('./redis');
const dbClient = require('./db');

const validateId = {
  isValidObjectId: (objectId) => ObjectId.isValid(objectId)
  && (String(new ObjectId(objectId)) === objectId),
};

module.exports = validateId;

const userAuthObject = {
  async getUserIdAndRedisKey(req) {
    const result = { userId: null, redisKey: null };
    const xToken = req.header('X-Token');

    if (!xToken) return result;

    result.redisKey = `auth_${xToken}`;

    try {
      result.userId = await redisClient.get(result.redisKey);
    } catch (error) {
      console.error('Error fetching user ID from Redis:', error);
    }

    return result;
  },

  async getUserFromDb(query) {
    try {
      const user = await dbClient.usersCollection.findOne(query);
      return user;
    } catch (error) {
      console.error('Error fetching user from database:', error);
      return null;
    }
  },
};

module.exports = userAuthObject;

const handleFiles = {
  validateBody: async (req) => {
    const {
      name, type, isPublic = false, data,
    } = req.body;

    let { parentId = 0 } = req.body;

    const allowedTypes = ['file', 'image', 'folder'];
    let errorMessage = null;

    if (parentId === '0') parentId = 0;

    if (!name) {
      errorMessage = 'Missing name';
    } else if (!type || !allowedTypes.includes(type)) {
      errorMessage = 'Missing type';
    } else if (!data && type !== 'folder') {
      errorMessage = 'Missing data';
    } else if (parentId && parentId !== '0') {
      let file;

      if (validateId.isValidId(parentId)) {
        file = await this.getFile({ _id: ObjectId(parentId) });
      } else {
        file = null;
      }

      if (!file) {
        errorMessage = 'Parent not found';
      } else if (file.type !== 'folder') {
        errorMessage = 'Parent is not a folder';
      }
    }

    return {
      error: errorMessage,
      fileParams: {
        name, type, parentId, isPublic, data,
      },
    };
  },

  getFile: async (query) => {
    const file = await dbClient.filesCollection.findOne(query);
    return file;
  },

  getFilesOfParentId: async (query) => {
    const fileList = await dbClient.filesCollection.aggregate(query);
    return fileList;
  },

  saveFile: async (userId, fileParams, FOLDER_PATH) => {
    const {
      name, type, isPublic, data,
    } = fileParams;
    let { parentId } = fileParams;

    if (parentId !== 0) parentId = ObjectId(parentId);

    const query = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
    };

    if (fileParams.type !== 'folder') {
      const fileNameUUID = uuidv4();
      const fileDataDecoded = Buffer.from(data, 'base64');
      const filePath = `${FOLDER_PATH}/${fileNameUUID}`;

      query.localPath = filePath;

      try {
        await fs.mkdir(FOLDER_PATH, { recursive: true });
        await fs.writeFile(filePath, fileDataDecoded);
      } catch (err) {
        return { error: err.message, code: 400 };
      }
    }

    const result = await dbClient.filesCollection.insertOne(query);

    const file = this.processFile(query);

    const newFile = { id: result.insertedId, ...file };

    return { error: null, newFile };
  },

  updateFile: async (query, set) => {
    const fileList = await dbClient.filesCollection.findOneAndUpdate(
      query,
      set,
      { returnOriginal: false },
    );
    return fileList;
  },

  publishUnpublish: async (req, setPublish) => {
    const { id: fileId } = req.params;

    if (!validateId.isValidId(fileId)) return { error: 'Unauthorized', code: 401 };

    const { userId } = await userAuthObject.getUserIdAndRedisKey(req);

    if (!validateId.isValidId(userId)) return { error: 'Unauthorized', code: 401 };

    const user = await userAuthObject.getUser({
      _id: ObjectId(userId),
    });

    if (!user) return { error: 'Unauthorized', code: 401 };

    const file = await this.getFile({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) return { error: 'Not found', code: 404 };

    const result = await this.updateFile(
      {
        _id: ObjectId(fileId),
        userId: ObjectId(userId),
      },
      { $set: { isPublic: setPublish } },
    );

    const {
      _id: id,
      userId: resultUserId,
      name,
      type,
      isPublic,
      parentId,
    } = result.value;

    const updatedFile = {
      id,
      userId: resultUserId,
      name,
      type,
      isPublic,
      parentId,
    };

    return { error: null, code: 200, updatedFile };
  },

  processFile(doc) {
    const file = { id: doc._id, ...doc };

    delete file.localPath;
    delete file._id;

    return file;
  },

  isOwnerAndPublic(file, userId) {
    if ((!file.isPublic && !userId)
          || (userId && file.userId.toString() !== userId && !file.isPublic)) return false;

    return true;
  },

  async getFileData(file, size) {
    let { localPath } = file;
    let data;

    if (size) localPath = `${localPath}_${size}`;

    try {
      data = await fs.readFile(localPath);
    } catch (err) {
      return { error: 'Not found', code: 404 };
    }

    return { data };
  },
};

module.exports = handleFiles;
