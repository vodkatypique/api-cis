// importing the dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const {startDatabase} = require('./db/mongo');
const {incrementUseIp, decrementUseIp, receiveHash, getBdd, sendHash, getIPs, workerDown, workerUp, getBestIP} = require('./db/bdd');

const jwt = require('jsonwebtoken');

const Speakeasy = require("speakeasy");

const bcrypt = require("bcrypt");

const { authenticate } = require('ldap-authentication');

var QRCode = require('qrcode');

var SSH = require('simple-ssh');

const app = express();

async function auth(uid, passwordLDAP) {  
    options = {
      ldapOpts: {
        url: 'ldap://ldap.forumsys.com',
        // tlsOptions: { rejectUnauthorized: false }
      },
      userDn: 'uid='+uid+',dc=example,dc=com',
      userPassword: passwordLDAP,
      userSearchBase: 'dc=example,dc=com',
        usernameAttribute: 'uid',
        username: uid,
      // starttls: false
    }
  
    user = await authenticate(options);
    return user;
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

//logique : (secret pour generer un secret relatif a l'user, puis) generate pour avoir un token si user/password est ok, puis validate pour verifier le token et avoir un jwt

app.post("/totp-secret", async (request, response, next) => { //sera dans ldap par default, cette fonction est donc inutile
    var secret = Speakeasy.generateSecret({ length: 20 }).base32;
    const user = await auth(request.body.username, request.body.password);
    console.log(user)
    if (user) {
        //addSecret(request.body.username, secret)
        response.status(200).json({ message: "Valid password" });
    } else {
        response.status(400).json({ error: "Invalid Password" });
    }
    //response.send({ "secret": secret.base32 }); 
});

app.post("/totp-generate", async (request, response, next) => {
    const user = await auth(request.body.username, request.body.password);
    console.log(user);
    if (user) {
        user.secret = 'KFDVGVSSHZ5GIZDOIM7DOUCSOMYDYQTQ' //pck pas add en ldap
 
// QRCode.toString('I am a pony!',{type:'terminal'}, function (err, url) {
//   console.log(url)
// })

        response.send({
            "token": Speakeasy.totp({
                secret: user.secret,
                encoding: "base32"
            }),
            "remaining": (300 - Math.floor((new Date()).getTime() / 1000.0 % 300))
     }); //dans le client irl
    } else {
        response.status(400).json({ error: "Invalid Password" });
    }
    
});
app.post("/totp-validate", async (request, response, next) => { 
    const username = request.body.username;
    user = auth(request.body.username, request.body.password);
    if (user) {
        console.log(1);
        user.secret = 'KFDVGVSSHZ5GIZDOIM7DOUCSOMYDYQTQ'//pck pas add en ldap
        const valid = Speakeasy.totp.verify({
            secret: user.secret,
            encoding: "base32",
            token: request.body.token,
            window: 0
        });
        console.log(valid)
        if (valid) {
            console.log(2);
            // Generate an access token
        const accessToken = jwt.sign({ username: username,  role: "user" }, accessTokenSecret); //role sera dans le ldap
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
app.get('/', async (req, res) => {
    res.send(await getBdd());
  });

app.post('/', authenticateJWT, async (req, res) => {
    sendHash(req.body.username, req.body.hash, req.body.format);
    res.send({username: req.body.username, hash: req.body.hash})
});

app.post('/retour', authenticateJWT, async (req, res) => { 
    var ip = req.socket.remoteAddress.substr(7);
    receiveHash(ip, req.body);
    res.send({req: req.body, ip: req.socket.remoteAddress});
});

app.post("/create-user", authenticateJWT, async (request, response, next) => {
    const { role } = request.user;
    console.log(role);
    if (role !== "creator") {
        
        response.status(400).json({ error: "Invalid role" });
        
    } else {
        //creer le role dans le ldap
        response.status(200).json({ message: "Valid role" });
    } 
});


//pour test
app.get('/ips', async (req, res) => { //pour test manuel
    res.send(await getIPs());
});

app.get('/bestIP', async (req, res) => { //pour test manuel
    res.send(await getBestIP());
});

app.post('/ipUp', authenticateJWT, async (req, res) => { //pour test manuel
    await workerUp(req.body.ip);
    res.status(200).json({ message: "OK" });
});

app.post('/ipDown', authenticateJWT, async (req, res) => { //pour test manuel
    await workerDown(req.body.ip);
    res.status(200).json({ message: "OK" });
});

// start the in-memory MongoDB instance
startDatabase().then(async () => {
    
    var ssh = new SSH({
        host: '172.17.12.27',
        user: 'vodkatypique',
        pass: 'baccareccia2B'
    });
    
    ssh.exec('ls -lh', {
        out: function(stdout) {
            console.log(stdout);
        }
    }).start();
    // start the server
    app.listen(3001, async () => {
      console.log('listening on port 3001');
    });
  });