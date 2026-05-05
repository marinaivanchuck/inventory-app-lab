const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Налаштування multer для збереження фото
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// Шлях до файлу БД
const dbPath = path.join(__dirname, 'db.json');

// Функції читання/запису
const readDB = async () => {
  const data = await fs.readJson(dbPath);
  return data;
};
const writeDB = async (data) => {
  await fs.writeJson(dbPath, data, { spaces: 2 });
};

// GET /inventory
app.get('/inventory', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/:id
app.get('/inventory/:id', async (req, res) => {
  try {
    const db = await readDB();
    const item = db.inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /register
app.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { inventory_name, description } = req.body;
    if (!inventory_name) {
      return res.status(400).json({ error: 'inventory_name is required' });
    }
    const db = await readDB();
    const newItem = {
      id: uuidv4(),
      inventory_name,
      description: description || '',
      photo: req.file ? `/uploads/${req.file.filename}` : null
    };
    db.inventory.push(newItem);
    await writeDB(db);
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /inventory/:id
app.put('/inventory/:id', async (req, res) => {
  try {
    const { inventory_name, description } = req.body;
    const db = await readDB();
    const index = db.inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    if (inventory_name) db.inventory[index].inventory_name = inventory_name;
    if (description !== undefined) db.inventory[index].description = description;
    await writeDB(db);
    res.json(db.inventory[index]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /inventory/:id/photo
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
    const db = await readDB();
    const index = db.inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    const oldPhoto = db.inventory[index].photo;
    if (oldPhoto) {
      const oldPath = path.join(__dirname, oldPhoto);
      if (await fs.pathExists(oldPath)) await fs.remove(oldPath);
    }
    const newPhotoPath = `/uploads/${req.file.filename}`;
    db.inventory[index].photo = newPhotoPath;
    await writeDB(db);
    res.json({ message: 'Photo updated', photo: newPhotoPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /inventory/:id
app.delete('/inventory/:id', async (req, res) => {
  try {
    const db = await readDB();
    const index = db.inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    const item = db.inventory[index];
    if (item.photo) {
      const photoPath = path.join(__dirname, item.photo);
      if (await fs.pathExists(photoPath)) await fs.remove(photoPath);
    }
    db.inventory.splice(index, 1);
    await writeDB(db);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
