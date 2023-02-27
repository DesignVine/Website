const express = require("express");
const app = express();
const fileUpload = require('express-fileupload');
const session = require('express-session');
const flash = require('express-flash');
const { pool } = require("./dbConfig");
const bcrypt = require('bcrypt');
const passport = require("passport");
const fs = require('fs');

const initializePassport =require("./passportConfig");

initializePassport(passport);

const PORT = process.env.PORT || 4000;

// middleware
app.use(fileUpload());
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: false}));
app.use(express.static(__dirname + "/public"));
app.use('/uploads', express.static(__dirname + '/uploads'));

// saves session details 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/', (req,res) => {
    res.render("index");
});

app.get('/users/register', checkAuthenticated, (req,res) => {
    res.render("register");
});

app.get('/users/login', checkAuthenticated, (req,res) => {
    res.render("login");
});

app.get('/users/dashboard', checkNotAuthenticated, async (req,res) => {
    // get list of customers for this user from projects db
    let projects;
    pool.query(
        `SELECT * FROM projects WHERE user_id = $1`,[req.user.id], (err, results)=> {
            if (err) {
                throw err;
            }
            if (results.rows.length > 0) {
                projects = results.rows;
                console.log(projects);
            }
            else {
                console.log("No rows");
            }
            res.render("dashboard", {user: req.user.firstname, customers: projects});
        }
    )
});


// fetch project data from database, parse and send to project page so that it can be added to the html elements via ejs
app.get('/project/:projectId', async function(req, res) {
    console.log(req.user)
    var projectId = req.params.projectId;
    console.log(projectId);
    pool.query(
        `SELECT m.message_id, m.message, m.img, m.created_at, u.firstname, u.lastname, u.email
        FROM messages m
        JOIN projects p ON m.project_id = p.project_id
        JOIN users u ON p.user_id = u.id
        WHERE m.project_id = $1`,[projectId], (err, results)=> {
            if (err) {
                res.send('<html><head><title>Error</title></head><body><h1>Error: ProjectID not found</h1></body></html>');            
            }
            console.log(results.rows);

            if (results.rows.length < 1) {
                res.send('<html><head><title>Error</title></head><body><h1>Error: ProjectID not found</h1></body></html>');            
            }
            else {
                let textMessages = [];
                let imageMessages = [];
                let username = results.rows[0].firstname;
                let userlastname = results.rows[0].lastname;
                let email = results.rows[0].email;
                results.rows.forEach((message) => {
                  if (message.img === null) {
                    textMessages.push(message);
                  } else {
                    imageMessages.push(message);
                  }
                });
                res.render("project", {projectId: projectId, messages:textMessages, images: imageMessages, firstname: username, lastname:userlastname, email:email});
            }
        }
    )
});

app.get('/users/logout', (req, res)=> {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.flash('success_msg', 'You have logged out');
        res.redirect('/users/login');
      });
});

app.get('/users/project', (req,res) => {
    res.render("project");
});

app.post('/users/dashboard', async (req, res) => {
    let { firstname, lastname, email, description, message} = req.body;
    let sampleFile;
    let uploadPath;
    let pid;
    if (!firstname || !lastname || !email ) {
        errors.push({message: "Please enter all fields"});
    }
    else {
        pool.query(
            `INSERT INTO projects (user_id, firstname, lastname, email, description)
            VALUES ($1, $2, $3, $4, $5) RETURNING project_id`, [req.user.id, firstname, lastname, email, description ], (err, results)=> {
                if (err) {
                    throw err;
                }
                pid = results.rows[0].project_id
                if(message) {
                    pool.query(
                        `INSERT INTO messages (user_id, project_id, message)
                        VALUES ($1, $2, $3)`, [req.user.id, pid, message], (err, results)=> {
                            if (err) {
                                throw err;
                            }
                            req.flash('success_msg', "Message added.");
                        }
                    )
                } 
                /*
                if files were uploaded in form
                move files to uploads folder
                add file path to messages db
                */
                if (req.files && Array.isArray(req.files.files)) {
                    req.files.files.forEach(file => {
                        sampleFile = file.file
                        if (!fs.existsSync(__dirname + '/uploads/'+(req.user.id).toString()+'/')){
                            fs.mkdirSync(__dirname + '/uploads/'+(req.user.id).toString(), { recursive: true });
                        }
                        uploadPath = __dirname + '/uploads/'+(req.user.id).toString()+'/' + file.name;
                
                        file.mv(uploadPath,(err) => {
                            if (err)
                            throw err;
                        });
                        pool.query(
                            `INSERT INTO messages (user_id, project_id, img)
                            VALUES ($1, $2, $3)`, [req.user.id, pid, uploadPath], (err, results)=> {
                                if (err) {
                                    throw err;
                                }
                                req.flash('success_msg', "Message added.");
                            }
                        )
                    });
                }
                else if(req.files) {
                    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
                    sampleFile = req.files.files;
                    if (!fs.existsSync(__dirname + '/uploads/'+(req.user.id).toString()+'/')){
                        fs.mkdirSync(__dirname + '/uploads/'+(req.user.id).toString(), { recursive: true });
                    }
                    uploadPath = __dirname + '/uploads/'+(req.user.id).toString()+'/' + sampleFile.name;

                    // Use the mv() method to place the file somewhere on your server
                    sampleFile.mv(uploadPath, function(err) {
                    if (err)
                        throw err;
                    });
                    pool.query(
                        `INSERT INTO messages (user_id, project_id, img)
                        VALUES ($1, $2, $3)`, [req.user.id, pid, uploadPath], (err, results)=> {
                            if (err) {
                                throw err;
                            }
                            req.flash('success_msg', "Message added.");
                        }
                    )
                }
                
                console.log(results.rows);
                req.flash('success_msg', "Project Added.");
            }
        )
    }
    res.redirect('/users/dashboard');
})

app.post('/users/register', async (req, res) => {
    let { firstname, lastname, email, password, password2} = req.body;
    console.log({
        firstname,
        lastname,
        email,
        password,
        password2
    });

    let errors = [];
    if (!firstname || !lastname || !email || !password || !password2) {
        errors.push({message: "Please enter all fields"});
    }

    if(password.length < 6 ) {
        errors.push({message: "Password should be at least 6 characters"});
    }

    if (password !== password2) {
        errors.push({message: "Passwords do not match"});
    }

    if (errors.length > 0) {
        res.render('register', { errors });
    } 
    else {
        // form validation has passed
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);

        pool.query(
            `SELECT * FROM users WHERE email = $1`,[email], (err, results)=> {
                if (err) {
                    throw err;
                }
                console.log(results.rows);

                if (results.rows.length > 0) {
                    errors.push({message: 'Email already registered'});
                    res.render('register', { errors })
                }
                else {
                    pool.query(
                        `INSERT INTO users (firstname, lastname, email, password)
                        VALUES ($1, $2, $3, $4)
                        RETURNING id, password`, [firstname, lastname, email, hashedPassword], (err, results)=> {
                            if (err) {
                                throw err;
                            }
                            console.log(results.rows);
                            req.flash('success_msg', "You are now registered. Please login");
                            res.redirect('/users/login');
                        }
                    )
                }
            }
        )
    }
})

app.post('/users/login', passport.authenticate('local', {
    successRedirect: '/users/dashboard',
    failureRedirect: '/users/login',
    failureFlash: true
}));

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/users/dashboard');
    }
    next();
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/users/login');
}

app.listen(PORT, ()=>{
    console.log(`Server Running on PORT ${PORT}`);
});