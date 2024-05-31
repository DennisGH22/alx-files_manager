const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await dbClient.collection('users').findOne({ token });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        name, type, parentId = 0, isPublic = false, data,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }
      if (!['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      let parent = null;
      if (parentId !== 0) {
        parent = await dbClient.collection('files').findOne({ _id: parentId });
        if (!parent) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parent.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      const newFile = {
        userId: user._id,
        name,
        type,
        isPublic,
        parentId,
      };

      if (type === 'folder') {
        const result = await dbClient.collection('files').insertOne(newFile);
        return res.status(201).json(result.ops[0]);
      }

      if (!fs.existsSync(FOLDER_PATH)) {
        fs.mkdirSync(FOLDER_PATH, { recursive: true });
      }

      const localPath = path.join(FOLDER_PATH, uuidv4());
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

      newFile.localPath = localPath;

      const result = await dbClient.collection('files').insertOne(newFile);
      return res.status(201).json(result.ops[0]);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;
