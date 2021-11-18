const {MongoMemoryServer} = require('mongodb-memory-server');
const {MongoClient} = require('mongodb');
const Speakeasy = require("speakeasy");
const bcrypt = require("bcrypt");

let database = null;

async function startDatabase() {
  const mongo = await MongoMemoryServer.create();
  const mongoDBURL = await mongo.getUri();
  
  const connection = await MongoClient.connect(mongoDBURL, {useNewUrlParser: true});
  database = connection.db();
  const salt = await bcrypt.genSalt(10);
    // now we set user password to hashed password
  var psw = await bcrypt.hash("root", salt);

  var {insertedId} = await database.collection("users").insertOne({"username" : "admin", "password": psw, "role":  "admin", secret: Speakeasy.generateSecret({ length: 20 })});
}

async function getDatabase() {
  if (!database) await startDatabase();
  return database;
}


module.exports = {
  getDatabase,
  startDatabase,
};