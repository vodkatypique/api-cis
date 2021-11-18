const {getDatabase} = require('./mongo');
const net = require('net');

var dateTime = require('node-datetime');

const axios = require('axios')
const https = require('https')

const { exec } = require('child_process')
// Allow self-signed
const httpsAgent = new https.Agent({ rejectUnauthorized: false })



const collectionName = 'bdd';

const collectionIPs = 'ips';


async function sendHash(username, hash, format) {
  console.log(hash, username, format);
    await deleteIpAndRework();
    const database = await getDatabase();
    const best = await database.collection(collectionIPs).find({}).sort({current_use: 1}).toArray();
    const ip = best[0].ip.split(" ").join("");
    hash.split("\n").forEach(async h => {
      var {insertedId} = await database.collection(collectionName).insertOne({"hash" : h, "username": username, "sendAt":  dateTime.create().format('Y-m-d H:M:S'), "sendTo": ip, "format": format});
    });

    axios.post(ip, {"hash": hash, "format": format}, { httpsAgent });
    console.log("hash post "+ ip + " data: "+ {"hash": hash, "format": format});
    await incrementUseIp(ip);
    return null;
  }

async function getBdd() {
  const database = await getDatabase();
  return database.collection(collectionName).find({}).toArray();
}

async function getUsers() {
  const database = await getDatabase();
  return database.collection("users").find({}).toArray();
}

async function getWorkersUp(){
  exec('./list-nodes.sh', (err, out) => {
    if (err) {
      console.log(err);
        return null;
    }
    const workerIp = out.split('\n')[0]
    console.log(workerIp);
    return workerIp;
})

}

async function deleteIpAndRework() {
  const ipsUp = await getWorkersUp();
  ipsUp.forEach(ip => {
    if (ip.length >= 7) {
      workerUp(ip);
    }
  });
  getIPs().forEach(ip => {
    if (!ipsUp.includes(ip)) {
      workerDown(ip);
    }
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
  if (!ipExist) {
    updatedId = await database.collection(collectionIPs).insertOne({"ip" : ip, "current_use": 0}); 
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
      await sendHash(elt.username, elt.hash, elt.format);
    });
  return deletedId;
}


module.exports = {
  receiveHash,
  getBdd,
  getUsers,
  sendHash,
  getIPs,
  workerDown,
  workerUp,
  incrementUseIp,
  decrementUseIp
};