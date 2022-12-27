const express = require("express");
const app = express();
const cors = require("cors");

const PORT = process.env.PORT || 4000;

// middleware
app.set("view engine", "ejs");

app.get('/', (req,res) => {
    res.render("index");
});

app.get('/users/register', (req,res) => {
    res.render("register");
});

app.get('/users/login', (req,res) => {
    res.render("login");
});

app.get('/users/dashboard', (req,res) => {
    res.render("dashboard");
});

app.listen(PORT, ()=>{
    console.log(`Server Ruunning on PORT ${PORT}`);
});