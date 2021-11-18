// importing the dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const {startDatabase, getDatabase} = require('./db/mongo');
const {incrementUseIp, decrementUseIp, receiveHash, getBdd, getUsers, sendHash, getIPs, workerDown, workerUp, getBestIP} = require('./db/bdd');

const jwt = require('jsonwebtoken');

const Speakeasy = require("speakeasy");

const bcrypt = require("bcrypt");


var QRCode = require('qrcode');


const app = express();

async function auth(username, password) {  
    const database = await getDatabase();
    const user = await database.collection("users").findOne({"username": username});
    if (user) {
        const validPassword = await bcrypt.compare(password, user.password);
        if (validPassword) {
            return user;
        }
    }
    return null;
  }
  
// adding Helmet to enhance your API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

const accessTokenSecret = 'youraccesstokensecret';


const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

//logique : generate pour avoir un token si user/password est ok, puis validate pour verifier le token et avoir un jwt


app.post("/totp-generate", async (request, response, next) => {
    const user = await auth(request.body.username, request.body.password);
    console.log(user);
    
    if (user) {
        QRCode.toDataURL(user.secret.otpauth_url, {type: 'terminal'}, function(err, data_url) {
            console.log(typeof data_url);
            response.send({
                "url": data_url
            });
    });
    } else {
        response.status(400).json({ error: "Invalid Credentials" });
    }
});

app.post("/totp-validate", async (request, response, next) => { 
    const username = request.body.username;
    user = await auth(request.body.username, request.body.password);
    if (user) {
        console.log(user);
        const valid = Speakeasy.totp.verify({
            secret: user.secret.base32,
            encoding: "base32",
            token: request.body.token,
            window: 0
        });
        console.log(valid)
        if (valid) {
            console.log(2);
            // Generate an access token
        const accessToken = jwt.sign({ username: username,  role: user.role }, accessTokenSecret,  { expiresIn: '5h' }); 
            console.log(3);
        response.json({
            accessToken 
        });
        }
    } else {
        response.status(400).json({ error: "Invalid Password" });
    }
});

// defining an endpoint to return all ads
// app.get('/', async (req, res) => {
//     res.send(await getBdd());
//   });

//   app.get('/users', async (req, res) => {
//     res.send(await getUsers());
//   });

app.post('/', authenticateJWT, async (req, res) => {
    sendHash(req.user.username, req.body.hash, req.body.format);
    res.send({username: req.body.hash, hash: req.body.format})
});

app.post('/retour', async (req, res) => { 
    var ip = req.socket.remoteAddress.substr(7);
    const ips = await getIPs();
    ips.forEach(element => {
        if (element.ip == ip){
            receiveHash(ip, req.body);
            res.send({req: req.body, ip: req.socket.remoteAddress});
            return null;        
        }
    });
});

app.post("/create-user", authenticateJWT, async (request, response, next) => {
    const { role } = request.user;

    if (role == "creator" && request.body.role == "user") {
        const salt = await bcrypt.genSalt(10);
        // now we set user password to hashed password
        var psw = await bcrypt.hash(request.body.password, salt);
        const database = await getDatabase();
        var {insertedId} = await database.collection("users").insertOne({"username" : request.body.username, "password": psw, "role":  "user", secret: Speakeasy.generateSecret({ length: 20 })});
    
        response.send({retour: "user cree"});
        
    } else if (role == "admin" && (request.body.role == "user" || request.body.role == "creator")) {
        const salt = await bcrypt.genSalt(10);
        // now we set user password to hashed password
        var psw = await bcrypt.hash(request.body.password, salt);
        const database = await getDatabase();
        var {insertedId} = await database.collection("users").insertOne({"username" : request.body.username, "password": psw, "role":  request.body.role, secret: Speakeasy.generateSecret({ length: 20 })});
        response.send({retour: "user cree"})

    } else {
        response.send({retour: "bad credential"})
    }
});


//pour test
// app.get('/ips', async (req, res) => { //pour test manuel
//     res.send(await getIPs());
// });

// app.get('/bestIP', async (req, res) => { //pour test manuel
//     res.send(await getBestIP());
// });

// app.post('/ipUp', authenticateJWT, async (req, res) => { //pour test manuel
//     await workerUp(req.body.ip);
//     res.status(200).json({ message: "OK" });
// });

// app.post('/ipDown', authenticateJWT, async (req, res) => { //pour test manuel
//     await workerDown(req.body.ip);
//     res.status(200).json({ message: "OK" });
// });

startDatabase().then(() => {
     // start the server
     app.listen(3001, async () => {
        console.log('listening on port 3001');
      });
});
