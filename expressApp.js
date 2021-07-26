"use strict";

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const bot = require("./bot");

const router = express.Router();
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public')));

router.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.post('/submit', function(req, res){
    console.log('Got body:', req.body);
    bot.init(req).catch((ex) => {
        console.log(ex);
    })
    res.sendStatus(200);
})

//add the router
app.use('/', router);
app.use(express.static('public'))
app.listen(process.env.port || 3000);

const port = process.env.port ? process.env.port : 3000;
console.log('Running at Port ' + port);