const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '../db.json');

function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: [], complaints: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (e) {
    return { users: [], complaints: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

class MockModel {
  constructor(collectionName, data = {}) {
    this._collectionName = collectionName;
    Object.assign(this, data);
    if (!this._id && !this.id) {
      this._id = 'mock_' + Math.random().toString(36).substr(2, 9);
      this.id = this._id;
    } else if (this._id && !this.id) {
      this.id = this._id;
    } else if (this.id && !this._id) {
      this._id = this.id;
    }
  }

  async save() {
    const db = readDb();
    const list = db[this._collectionName] || [];

    if (!this._id && this.id) {
      this._id = this.id;
    }
    if (!this.id && this._id) {
      this.id = this._id;
    }

    const index = list.findIndex(item => item._id === this._id || item.id === this.id);
    
    const plainData = { ...this };
    delete plainData._collectionName;

    if (index >= 0) {
      list[index] = plainData;
    } else {
      list.push(plainData);
    }
    db[this._collectionName] = list;
    writeDb(db);
    return this;
  }

  static _matches(item, query) {
    if (!query) return true;
    
    if (query.$or) {
      return query.$or.some(subQuery => this._matches(item, subQuery));
    }

    for (const [key, val] of Object.entries(query)) {
      if (val && typeof val === 'object' && val.$regex) {
        const regex = val.$regex instanceof RegExp ? val.$regex : new RegExp(val.$regex, 'i');
        const itemVal = item[key] || '';
        if (!regex.test(itemVal)) return false;
      } else {
        if (key === '_id' || key === 'id') {
          if (item._id !== val && item.id !== val) return false;
        } else {
          if (item[key] !== val) return false;
        }
      }
    }
    return true;
  }

  static find(query) {
    const db = readDb();
    const list = db[this.collectionName] || [];
    const filtered = list.filter(item => this._matches(item, query));
    
    const queryObj = {
      sort: (sortObj) => {
        if (sortObj) {
          if (sortObj.timestamp === -1 || sortObj.createdAt === -1) {
            filtered.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
          }
        }
        return queryObj;
      },
      select: (selectStr) => {
        return queryObj;
      },
      then: (onfulfilled) => {
        return Promise.resolve(filtered.map(item => new this(item))).then(onfulfilled);
      },
      catch: (onrejected) => {
        return Promise.resolve(filtered.map(item => new this(item))).catch(onrejected);
      }
    };
    return queryObj;
  }

  static findOne(query) {
    const db = readDb();
    const list = db[this.collectionName] || [];
    const found = list.find(item => this._matches(item, query));
    const modelInstance = found ? new this(found) : null;

    const queryObj = {
      select: (selectStr) => {
        return queryObj;
      },
      then: (onfulfilled) => {
        return Promise.resolve(modelInstance).then(onfulfilled);
      },
      catch: (onrejected) => {
        return Promise.resolve(modelInstance).catch(onrejected);
      }
    };
    return queryObj;
  }

  static findById(id) {
    return this.findOne({ _id: id });
  }
}

class MockUser extends MockModel {
  static collectionName = 'users';
  constructor(data) {
    super('users', data);
  }
}

class MockComplaint extends MockModel {
  static collectionName = 'complaints';
  constructor(data) {
    super('complaints', data);
  }
}

class MockStaff extends MockModel {
  static collectionName = 'staff';
  constructor(data) {
    super('staff', data);
  }
}

module.exports = {
  MockUser,
  MockComplaint,
  MockStaff
};

