// In-memory mock database for development without MongoDB
let users = [];
let referrals = [];
let gameRecords = [];

const generateId = () => Math.random().toString(36).substr(2, 9);

const mockDB = {
  users: {
    findOne: async (query) => {
      if (query.$or) {
        return users.find(u => u.email === query.$or[0].email || u.mobile === query.$or[1].mobile);
      }
      if (query.email) return users.find(u => u.email === query.email);
      if (query.referralCode) return users.find(u => u.referralCode === query.referralCode);
      if (query._id) return users.find(u => u._id === query._id);
      return null;
    },
    create: async (data) => {
      const user = { _id: generateId(), ...data };
      users.push(user);
      return user;
    },
    countDocuments: async () => users.length,
    find: async () => users
  },
  referrals: {
    create: async (data) => {
      const ref = { _id: generateId(), ...data };
      referrals.push(ref);
      return ref;
    }
  },
  transactions: {
    create: async (data) => ({ _id: generateId(), ...data }),
    find: async () => []
  },
  gameHistory: [],  // Store game records here
  gameRecords: {
    create: async (data) => {
      const record = { _id: generateId(), ...data };
      gameRecords.push(record);
      return record;
    },
    find: async (query) => {
      if (!query || !query.userId) return gameRecords;
      return gameRecords.filter(r => r.userId === query.userId);
    },
    findByIdAndSort: async (userId) => {
      return gameRecords
        .filter(r => r.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);
    }
  }
};

module.exports = mockDB;

