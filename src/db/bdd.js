const {getDatabase} = require('./mongo');
const net = require('net');

var dateTime = require('node-datetime');


const collectionName = 'bdd';

const collectionIPs = 'ips';


async function sendHash(username, hash, format) {
  console.log(hash, username, format);
    const database = await getDatabase();
    const best = await database.collection(collectionIPs).find({}).sort({current_use: 1}).toArray();
    const ip = best[0].ip.split(" ").join("");
    hash.split("\n").forEach(async h => {
      var {insertedId} = await database.collection(collectionName).insertOne({"hash" : h, "username": username, "sendAt":  dateTime.create().format('Y-m-d H:M:S'), "sendTo": ip});
    });

    var client = new net.Socket();
    client.connect(1605, ip, await function() {//ip du netcat. while true; do nc -l -p 1605; done dans ubuntu marche
      console.log('sending to server: '+ ip);
      client.write(hash + " " + format);
      client.end();
  });

    await incrementUseIp(ip);
    return null;
  }

async function getBdd() {
  const database = await getDatabase();
  return database.collection(collectionName).find({}).toArray();
}

async function deleteIpAndRework() {
  const database = await getDatabase();
  const date = new Date(dateTime.create().now() - 1000*60).getTime();
  const find = await database.collection(collectionIPs).find({last_ping: {$lte: date}}).toArray();
  const deleted = await database.collection(collectionIPs).deleteMany({last_ping: {$lte: date}});
  
  //rework
  find.forEach(async entree => {
    const works = await database.collection(collectionName).find({sendTo: entree.ip}).toArray();
    works.forEach(async elt => {
      await sendHash(elt.username, elt.hash);
    });
  });
  return null;
}


async function incrementUseIp(ip) {
  const database = await getDatabase();
  const {updatedId} = await database.collection(collectionIPs).findOneAndUpdate({"ip" : ip}, {$inc: {current_use: 1}});
  return updatedId;
}

async function decrementUseIp(ip) {
  const database = await getDatabase();
  const {updatedId} = await database.collection(collectionIPs).findOneAndUpdate({"ip" : ip}, {$inc: {current_use: -1}});
  return updatedId;
}



async function getIPs() {
  await deleteIpAndRework();
  const database = await getDatabase();
  return database.collection(collectionIPs).find({}).toArray();
}

async function receiveHash(ip_source, hash) {
  const database = await getDatabase();
  
  for (const key in hash) {
    if (Object.hasOwnProperty.call(hash, key)) {
      var {updatedId} = await database.collection(collectionName).updateOne({"hash" : key}, {$set: {hashClear: hash[key], "receiveAt":  dateTime.create().now()}});
    }
  }
  decrementUseIp(ip_source);
  return updatedId;
}

async function workerUp(ip) {
  const database = await getDatabase();
  const ipExist = await database.collection(collectionIPs).findOne({"ip": ip});
  let updatedId = null;
  if (ipExist) {
    updatedId = await database.collection(collectionIPs).updateOne({"ip" : ip}, {$set: {"last_ping":  dateTime.create().now()}}, {upsert: true}); 
  } else {
    updatedId = await database.collection(collectionIPs).updateOne({"ip" : ip, "current_use": 0}, {$set: {"last_ping":  dateTime.create().now()}}, {upsert: true}); 
  }
  return updatedId;
}

async function workerDown(ip) {
  const database = await getDatabase();
  const find = await database.collection(collectionIPs).findOne({ip: ip});
  const {deletedId} = await database.collection(collectionIPs).deleteOne({"ip" : ip});
  console.log(find);
  //reassigné les work en cours sur ce worker vers les autres.  
  //rework
    const works = await database.collection(collectionName).find({sendTo: find.ip}).toArray();
    works.forEach(async elt => {
      await sendHash(elt.username, elt.hash);
    });
  return deletedId;
}


module.exports = {
  receiveHash,
  getBdd,
  sendHash,
  getIPs,
  workerDown,
  workerUp,
  incrementUseIp,
  decrementUseIp
};