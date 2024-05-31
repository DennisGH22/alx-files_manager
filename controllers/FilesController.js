// controllers/FilesController.js
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class FilesController {
  static async postUpload(req, res) {
    const {
      name, type, data, parentId = 0, isPublic = false,
    } = req.body;
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: dbClient.ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const newFile = {
      userId: dbClient.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: dbClient.ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(newFile);
      newFile.id = result.insertedId;
      return res.status(201).json(newFile);
    }
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileData = Buffer.from(data, 'base64');

    const fileName = `${uuidv4()}.${type === 'image' ? 'png' : 'txt'}`;
    const filePath = path.join(folderPath, fileName);

    fs.writeFileSync(filePath, fileData);

    newFile.localPath = filePath;
    const result = await dbClient.db.collection('files').insertOne(newFile);
    newFile.id = result.insertedId;
    return res.status(201).json(newFile);
  }
}

module.exports = FilesController;
