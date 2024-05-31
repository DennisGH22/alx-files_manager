const { ObjectId } = require('mongodb');
const mime = require('mime-types');
const Queue = require('bull');
const { validateId, userAuthObject, handleFiles } = require('../utils/auth');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const fileQueue = new Queue('fileQueue');

class FilesController {
  static uploadFile = async (req, res) => {
    const { userId } = await userAuthObject.getUserIdAndRedisKey(req);

    if (!validateId.isValidId(userId)) {
        return res.status(401).send({ error: 'Unauthorized' });
    }
    if (!userId && req.body.type === 'image') {
        await fileQueue.add({});
    }

    const user = await userAuthObject.getUser({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const { error: validationError, fileParams } = await handleFiles.validateBody(req);

    if (validationError) return res.status(400).send({ error: validationError });

    if (fileParams.parentId !== 0 && !validateId.isValidId(fileParams.parentId)) {
        return res.status(400).send({ error: 'Parent not found' });
    }

    const { error, code, newFile } = await handleFiles.saveFile(userId, fileParams, FOLDER_PATH);

    if (error) {
        if (req.body.type === 'image') await fileQueue.add({ userId });
        return res.status(code).send(error);
    }

    if (fileParams.type === 'image') {
        await fileQueue.add({
            fileId: newFile.id.toString(),
            userId: newFile.userId.toString(),
        });
    }

    return res.status(201).send(newFile);
  }

  static getFileDetails = async (req, res) => {
    const fileId = req.params.id;
    const { userId } = await userAuthObject.getUserIdAndRedisKey(req);
    const user = await userAuthObject.getUser({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    if (!validateId.isValidId(fileId) || !validateId.isValidId(userId)) {
        return res.status(404).send({ error: 'Not found' });
    }

    const fileData = await handleFiles.getFile({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    if (!fileData) return res.status(404).send({ error: 'Not found' });

    const file = handleFiles.processFile(fileData);

    return res.status(200).send(file);
  }

  static listFiles = async (req, res) => {
    const { userId } = await userAuthObject.getUserIdAndRedisKey(req);
    const user = await userAuthObject.getUser({ _id: ObjectId(userId) });

    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    let parentId = req.query.parentId || '0';
    if (parentId === '0') parentId = 0;

    let page = Number(req.query.page) || 0;
    if (Number.isNaN(page)) page = 0;

    if (parentId !== 0 && parentId !== '0') {
        if (!validateId.isValidId(parentId)) {
            return res.status(401).send({ error: 'Unauthorized' });
        }

        parentId = ObjectId(parentId);
        const folder = await handleFiles.getFile({ _id: ObjectId(parentId) });

        if (!folder || folder.type !== 'folder') return res.status(200).send([]);
    }

    const pipeline = [{ $match: { parentId } }, { $skip: page * 20 }, { $limit: 20 }];
    const fileCursor = await handleFiles.getFilesOfParentId(pipeline);
    const files = [];

    await fileCursor.forEach((doc) => {
        const file = handleFiles.processFile(doc);
        files.push(file);
    });

    return res.status(200).send(files);
  }

  static publishFile = async (req, res) => {
    const { error, code, updatedFile } = await handleFiles.publishUnpublish(req, true);
    if (error) return res.status(code).send({ error });
    return res.status(code).send(updatedFile);
  }

  static unpublishFile = async (req, res) => {
    const { error, code, updatedFile } = await handleFiles.publishUnpublish(req, false);
    if (error) return res.status(code).send({ error });
    return res.status(code).send(updatedFile);
  }

  static getFileContent = async (req, res) => {
    const { userId } = await userAuthObject.getUserIdAndRedisKey(req);
    const { id: fileId } = req.params;
    const size = req.query.size || 0;

    if (!validateId.isValidId(fileId)) return res.status(404).send({ error: 'Not found' });

    const file = await handleFiles.getFile({ _id: ObjectId(fileId) });

    if (!file || !handleFiles.isOwnerAndPublic(file, userId)) {
        return res.status(404).send({ error: 'Not found' });
    }

    if (file.type === 'folder') {
        return res.status(400).send({ error: "A folder doesn't have content" });
    }

    const { error, code, data } = await handleFiles.getFileData(file, size);

    if (error) return res.status(code).send({ error });

    const mimeType = mime.contentType(file.name);
    res.setHeader('Content-Type', mimeType);

    return res.status(200).send(data);
  }
}

module.exports = FilesController;
