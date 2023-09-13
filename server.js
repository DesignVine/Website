// Business Address: 8 Main St Suite 9A, Jaffrey, NH 03452
// process.env.TZ = 'EDT'; // REQUIRED ON SERVER

const express = require("express");
const app = express();
const fileUpload = require('express-fileupload');
const session = require('express-session');
const flash = require('express-flash');
const { pool } = require("./dbConfig");
const bcrypt = require('bcrypt');
const passport = require("passport");
const fs = require('fs');
const path = require('path');
const util = require('util');

const initializePassport =require("./passportConfig");
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465, // Use 465 for SSL
  secure: true, // true for 465, false for other ports
  auth: {
    user: 'designvine@zohomail.com',
    pass: 'fgh543q$ST',
  },
});
//Company Name - Subject Link - Message
// Customer Name, Message, Timestamp
async function sendNotificationEmail(to, cc, subject, text) {
    try {
        let mailOptions = {}
        if(cc !== '') {
            mailOptions = {
                from: 'designvine@zohomail.com',
                to: to,
                cc: cc,
                subject: subject,
                text: text,
            };
        } else {
            mailOptions = {
                from: 'designvine@zohomail.com',
                to: to,
                subject: subject,
                text: text,
            };
        }
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
initializePassport(passport);

const PORT = process.env.PORT || 4000;

// middleware
app.use(fileUpload());
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: false}));
app.use(express.static(__dirname + "/public"));
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use('/pfp', express.static(__dirname + '/pfp'));


app.use(express.json());

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
app.get('/about', (req,res) => {
    res.render("about");
});
app.get('/users/register', checkAuthenticated, (req,res) => {
    res.render("register");
});

app.get('/users/login', checkAuthenticated, (req,res) => {
    res.render("login");
});

app.get('/users/settings', checkNotAuthenticated, (req,res) => {
    res.render("settings");
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
            res.render("dashboard", {user: req.user.firstname, customers: projects, user_id: req.user.id});
        }
    )
});


app.get('/project/:projectId', async function(req, res) {
    var projectId = req.params.projectId;

    pool.query(
        `SELECT m.message_id, m.message, m.img, m.caption, m.img_order, m.created_at, m.sender, 
                u.id as user_id, u.firstname, u.lastname, u.email, u.phone, u.instagram, u.facebook, 
                u.twitter, u.business_desc, u.profile_photo, u.business_address
        FROM messages m
        JOIN projects p ON m.project_id = p.project_id
        JOIN users u ON p.user_id = u.id
        WHERE m.project_id = $1
        ORDER BY m.img_order ASC`, [projectId], (err, results) => {
            if (err) {
                res.send('<html><head><title>Error</title></head><body><h1>Error: ProjectID not found</h1></body></html>');            
            }
            else if (!results || !results.rows || results.rows.length < 1) {
                // Query to get the project and user details without joining the messages table
                pool.query(
                    `SELECT u.id as user_id, u.firstname as user_firstname, u.lastname as user_lastname, u.email as user_email,
                             u.phone, u.instagram, u.facebook, u.twitter, u.business_desc, u.profile_photo, u.business_address,
                             p.firstname as project_firstname, p.lastname as project_lastname, p.email as project_email
                     FROM projects p
                     JOIN users u ON p.user_id = u.id
                     WHERE p.project_id = $1`, [projectId], (err, projectResults) => {
                        if (err || !projectResults || !projectResults.rows || projectResults.rows.length < 1) {
                            res.send('<html><head><title>Error</title></head><body><h1>Error: ProjectID not found</h1></body></html>');
                        } else {
                            let user_firstname = projectResults.rows[0].user_firstname;
                            let user_lastname = projectResults.rows[0].user_lastname;
                            let user_email = projectResults.rows[0].user_email;
                            let project_firstname = projectResults.rows[0].project_firstname;
                            let project_lastname = projectResults.rows[0].project_lastname;
                            let project_email = projectResults.rows[0].project_email;
                            let phone = projectResults.rows[0].phone;
                            let instagram = projectResults.rows[0].instagram;
                            let facebook = projectResults.rows[0].facebook;
                            let twitter = projectResults.rows[0].twitter;
                            let business_description = projectResults.rows[0].business_desc;
                            let profile_picture;
            
                            try {
                                profile_picture = projectResults.rows[0].profile_photo.replace(/^.*[\\\/]pfp[\\\/]/, '/pfp/');
                            } catch (err) {
                                profile_picture = '';  // Or set it to a default image
                            }
            
                            let business_address = projectResults.rows[0].business_address;
            
                            res.render("project", {
                                formatDate: formatDate,
                                projectId: projectId,
                                userId: req.params.userId,
                                messages: [], // Empty messages
                                images: [], // Empty images
                                firstname: user_firstname,
                                lastname: user_lastname,
                                email: user_email,
                                project_firstname: project_firstname,
                                project_lastname: project_lastname,
                                project_email: project_email,
                                phone: phone,
                                instagram: instagram,
                                facebook: facebook,
                                twitter: twitter,
                                business_description: business_description,
                                profile_picture: profile_picture,
                                business_address: business_address,
                                view: "client"
                            });
                        }
                    }
                );
            }
            else {
                let textMessages = [];
                let imageMessages = [];
                let username = results.rows[0].firstname;
                let userlastname = results.rows[0].lastname;
                let email = results.rows[0].email;
                let phone = results.rows[0].phone;
                let instagram = results.rows[0].instagram;
                let facebook = results.rows[0].facebook;
                let twitter = results.rows[0].twitter;
                let business_description = results.rows[0].business_desc;
                let profile_picture;

                try {
                    profile_picture = results.rows[0].profile_photo.replace(/^.*[\\\/]pfp[\\\/]/, '/pfp/');
                } catch (err) {
                    profile_picture = '';  // Or set it to a default image
                }
                let business_address = results.rows[0].business_address;

                results.rows.forEach((message) => {
                  if (message.img === null) {
                    textMessages.push(message);
                  } else {
                    imageMessages.push(message);
                  }
                });

                let userId = textMessages[0].user_id;
                textMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                textMessages.reverse()

                
                res.render("project", {
                    formatDate: formatDate,
                    projectId: projectId, 
                    userId: userId, 
                    messages: textMessages, 
                    images: imageMessages, 
                    firstname: username, 
                    lastname: userlastname, 
                    email: email,
                    phone: phone, 
                    instagram: instagram, 
                    facebook: facebook, 
                    twitter: twitter, 
                    business_description: business_description,
                    profile_picture: profile_picture,
                    business_address: business_address,
                    view: "client"
                });
            }
        }
    )
});


app.get('/project/:projectId/:userId', async function(req, res) {

    var projectId = req.params.projectId;

    pool.query(
        `SELECT m.message_id, m.message, m.img, m.caption, m.img_order, m.created_at, m.sender, 
                u.id as user_id, u.firstname as user_firstname, u.lastname as user_lastname, u.email as user_email, 
                u.phone, u.instagram, u.facebook, u.twitter, u.business_desc, u.profile_photo, u.business_address,
                p.firstname as project_firstname, p.lastname as project_lastname, p.email as project_email
        FROM messages m
        JOIN projects p ON m.project_id = p.project_id
        JOIN users u ON p.user_id = u.id
        WHERE m.project_id = $1
        ORDER BY m.img_order ASC`, [projectId], (err, results) => {
            if (err) {
                res.send('<html><head><title>Error</title></head><body><h1>Error: ProjectID not found</h1></body></html>');            
            }
            else if (!results || !results.rows || results.rows.length < 1) {
                // Query to get the project and user details without joining the messages table
                pool.query(
                    `SELECT u.id as user_id, u.firstname as user_firstname, u.lastname as user_lastname, u.email as user_email,
                             u.phone, u.instagram, u.facebook, u.twitter, u.business_desc, u.profile_photo, u.business_address,
                             p.firstname as project_firstname, p.lastname as project_lastname, p.email as project_email
                     FROM projects p
                     JOIN users u ON p.user_id = u.id
                     WHERE p.project_id = $1`, [projectId], (err, projectResults) => {
                        if (err || !projectResults || !projectResults.rows || projectResults.rows.length < 1) {
                            res.send('<html><head><title>Error</title></head><body><h1>Error: ProjectID not found</h1></body></html>');
                        } else {
                            let user_firstname = projectResults.rows[0].user_firstname;
                            let user_lastname = projectResults.rows[0].user_lastname;
                            let user_email = projectResults.rows[0].user_email;
                            let project_firstname = projectResults.rows[0].project_firstname;
                            let project_lastname = projectResults.rows[0].project_lastname;
                            let project_email = projectResults.rows[0].project_email;
                            let phone = projectResults.rows[0].phone;
                            let instagram = projectResults.rows[0].instagram;
                            let facebook = projectResults.rows[0].facebook;
                            let twitter = projectResults.rows[0].twitter;
                            let business_description = projectResults.rows[0].business_desc;
                            let profile_picture;
            
                            try {
                                profile_picture = projectResults.rows[0].profile_photo.replace(/^.*[\\\/]pfp[\\\/]/, '/pfp/');
                            } catch (err) {
                                profile_picture = '';  // Or set it to a default image
                            }
            
                            let business_address = projectResults.rows[0].business_address;
            
                            res.render("project", {
                                formatDate: formatDate,
                                projectId: projectId,
                                userId: req.params.userId,
                                messages: [], // Empty messages
                                images: [], // Empty images
                                firstname: user_firstname,
                                lastname: user_lastname,
                                email: user_email,
                                project_firstname: project_firstname,
                                project_lastname: project_lastname,
                                project_email: project_email,
                                phone: phone,
                                instagram: instagram,
                                facebook: facebook,
                                twitter: twitter,
                                business_description: business_description,
                                profile_picture: profile_picture,
                                business_address: business_address,
                                view: "user"
                            });
                        }
                    }
                );
            }
            else {
                let textMessages = [];
                let imageMessages = [];
                let user_firstname = results.rows[0].user_firstname;
                let user_lastname = results.rows[0].user_lastname;
                let user_email = results.rows[0].user_email;
                let project_firstname = results.rows[0].project_firstname;
                let project_lastname = results.rows[0].project_lastname;
                let project_email = results.rows[0].project_email;
                let phone = results.rows[0].phone;
                let instagram = results.rows[0].instagram;
                let facebook = results.rows[0].facebook;
                let twitter = results.rows[0].twitter;
                let business_description = results.rows[0].business_desc;
                let profile_picture;

                try {
                    profile_picture = results.rows[0].profile_photo.replace(/^.*[\\\/]pfp[\\\/]/, '/pfp/');
                } catch (err) {
                    profile_picture = '';  // Or set it to a default image
                }
                
                let business_address = results.rows[0].business_address;

                results.rows.forEach((message) => {
                  if (message.img === null) {
                    textMessages.push(message);
                  } else {
                    imageMessages.push(message);
                  }
                });
                textMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                textMessages.reverse()
                
                res.render("project", {
                    formatDate: formatDate,
                    projectId: projectId, 
                    userId: req.params.userId, 
                    messages: textMessages, 
                    images: imageMessages, 
                    firstname: user_firstname, 
                    lastname: user_lastname, 
                    email: user_email,
                    project_firstname: project_firstname, 
                    project_lastname: project_lastname, 
                    project_email: project_email,
                    phone: phone, 
                    instagram: instagram, 
                    facebook: facebook, 
                    twitter: twitter, 
                    business_description: business_description,
                    profile_picture: profile_picture,
                    business_address: business_address,
                    view: "user"
                });
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
app.get('/howitworks', (req,res) => {
    res.render("howitworks");
});
app.post('/project', async function(req, res) {

    let sampleFile;
    let message = req.body.textMessage;
    let sender = req.body.view; // user (business) or client (customer)
    let user_id = req.body.userId;
    let pid = req.body.projectId;
    let textMessageAdded = false;
    let imageMessageAdded = false;

    // Insert message only if it's not empty
    if (message !== '') {
        textMessageAdded = true;
        pool.query(
            `INSERT INTO messages (user_id, project_id, message, sender)
            VALUES ($1, $2, $3, $4)`, [user_id, pid, message, sender], (err, results)=> {
                if (err) {
                    throw err;
                }
                req.flash('success_msg', "Message added.");
            }
        )
    }

    // Process the uploaded files
    if (req.files && Array.isArray(req.files.files)) {
        imageMessageAdded = true;
        req.files.files.forEach(file => {
            sampleFile = file.file
            if (!fs.existsSync(__dirname + '/uploads/'+(user_id).toString()+'/')){
                fs.mkdirSync(__dirname + '/uploads/'+(user_id).toString(), { recursive: true });
            }
            uploadPath = __dirname + '/uploads/'+(user_id).toString()+'/' + file.name;
    
            file.mv(uploadPath,(err) => {
                if (err)
                throw err;
            });
            pool.query(
                `INSERT INTO messages (user_id, project_id, img, sender)
                VALUES ($1, $2, $3, $4)`, [user_id, pid, uploadPath, sender], (err, results)=> {
                    if (err) {
                        throw err;
                    }
                    req.flash('success_msg', "Message added.");
                }
            )
        });
    }
    else if(req.files) {
        imageMessageAdded = true;
        sampleFile = req.files.files;
        if (!fs.existsSync(__dirname + '/uploads/'+(user_id).toString()+'/')){
            fs.mkdirSync(__dirname + '/uploads/'+(user_id).toString(), { recursive: true });
        }
        uploadPath = __dirname + '/uploads/'+(user_id).toString()+'/' + sampleFile.name;

        sampleFile.mv(uploadPath, function(err) {
        if (err)
            throw err;
        });
        pool.query(
            `INSERT INTO messages (user_id, project_id, img, sender)
            VALUES ($1, $2, $3, $4)`, [user_id, pid, uploadPath, sender], (err, results)=> {
                if (err) {
                    throw err;
                }
                req.flash('success_msg', "Message added.");
            }
        )
    }

    // Send the email notification
    pool.query(
        `SELECT u.email AS user_email, p.email AS project_email
        FROM users u
        JOIN projects p ON u.id = p.user_id
        WHERE u.id = $1 AND p.project_id = $2`, [user_id, pid], (err, results) => {
            if (err) {
                throw err;
            }
            let recipientEmail;
            let emailContent;
            let subject;
            if (sender !== 'user') {
                const { user_email, project_email } = results.rows[0];
                recipientEmail = (sender === 'user') ? project_email : user_email;
                const emailSender = (sender === 'user') ? user_email : project_email;
                const link = (sender === 'user') ? `https://designvine.co/project/${pid}` : `https://designvine.co/project/${pid}/${user_id}`;
                // Determine the email content

                if (textMessageAdded && !imageMessageAdded) {
                    emailContent = `New message sent by ${emailSender}: ${message}. Check it out here ${link}`;
                    subject = 'Do Not Reply - New message received';
                } else if (!textMessageAdded && imageMessageAdded) {
                    subject = 'Do Not Reply - New images added to your project'
                    emailContent = `New images added by: ${emailSender}. Check it out here ${link}`;
                } else {
                    subject = "Do Not Reply - A new message and images have been added to your project";
                    emailContent = `A new message and images have been added to the project by: ${emailSender}. Check it out here ${link}`;
                }
                            // Send the email notification
            sendNotificationEmail(
                recipientEmail,
                subject,
                emailContent
            );
            }

        }
    );
    
    res.redirect('back')
});


app.post('/users/dashboard', async (req, res) => {
    let { project_name, firstname, lastname, email, description, message} = req.body;
    let sampleFile;
    let uploadPath;
    let pid;
    if (!firstname || !lastname || !email ) {
        errors.push({message: "Please enter all fields"});
    }
    else {
        pool.query(
            `INSERT INTO projects (user_id, firstname, lastname, email, description, project_name)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING project_id`, [req.user.id, firstname, lastname, email, description, project_name ], (err, results)=> {
                if (err) {
                    throw err;
                }
                pid = results.rows[0].project_id
                if(message) {
                    pool.query(
                        `INSERT INTO messages (user_id, project_id, message, sender)
                        VALUES ($1, $2, $3, $4)`, [req.user.id, pid, message, "user"], (err, results)=> {
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
                            `INSERT INTO messages (user_id, project_id, img, sender)
                            VALUES ($1, $2, $3, $4)`, [req.user.id, pid, uploadPath, "user"], (err, results)=> {
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
                        `INSERT INTO messages (user_id, project_id, img, sender)
                        VALUES ($1, $2, $3, $4)`, [req.user.id, pid, uploadPath, "user"], (err, results)=> {
                            if (err) {
                                throw err;
                            }
                            req.flash('success_msg', "Message added.");
                        }
                    )
                }
                
                req.flash('success_msg', "Project Added.");
            }
        )
    }
    res.redirect('/users/dashboard');
})

app.post('/save-page', async (req, res) => {
    const { orderedImages } = req.body;
    try {
        await pool.connect();

        // Start transaction
        await pool.query('BEGIN');

        for (let i = 0; i < orderedImages.length; i++) {
            await pool.query(
                `UPDATE messages 
                SET img_order = $1, caption = $2
                WHERE message_id = $3`, 
                [i + 1, orderedImages[i].caption, orderedImages[i].id]
            );
        }

        // Commit transaction
        await pool.query('COMMIT');
        
        res.json({ status: 'success' });
    } catch (err) {
        // Rollback transaction in case of any error
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ status: 'error', message: err.toString() });
    }
});



app.post('/users/register', async (req, res) => {
    let { firstname, lastname, email, password, password2} = req.body;

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

app.post('/users/settings', async (req, res) => {
    const { email, tel, instagram, facebook, twitter, desc, businessAddress,businessName, files } = req.body;
    let user_id = req.user.id;

    // Object to store the fields to update
    const fieldsToUpdate = {};

    // Only add fields that have a value
    if (tel) fieldsToUpdate.phone = tel;
    if (instagram) fieldsToUpdate.instagram = instagram;
    if (facebook) fieldsToUpdate.facebook = facebook;
    if (twitter) fieldsToUpdate.twitter = twitter;
    if (desc) fieldsToUpdate.business_desc = desc;
    if (businessAddress) fieldsToUpdate.business_address = businessAddress;
    if (businessName) fieldsToUpdate.business_name = businessName;

    try {
        // Get a client from the connection pool
        const client = await pool.connect();

        // Start transaction
        await client.query('BEGIN');

        // Handle file upload
        if (req.files) {
            const sampleFile = req.files.files;
            const uploadDir = path.join(__dirname, '/pfp', user_id.toString());
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const uploadPath = path.join(uploadDir, sampleFile.name);

            // Move the file
            await util.promisify(sampleFile.mv)(uploadPath);

            // Add the profile_photo to the update fields
            fieldsToUpdate.profile_photo = uploadPath;
        }

        // Construct the SQL UPDATE query
        const setString = Object.keys(fieldsToUpdate)
            .map((key, i) => `${key} = $${i + 1}`)
            .join(', ');

        const values = Object.values(fieldsToUpdate);
        // Append the user id to the values array
        values.push(user_id);

        await client.query(
            `UPDATE users SET ${setString} WHERE id = $${values.length}`,
            values
        );

        // Commit transaction
        await client.query('COMMIT');

        // Release the client back to the pool
        client.release();

        // Redirect to dashboard
        res.redirect('/users/dashboard');
    } catch (err) {
        // Rollback transaction in case of any error
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ status: 'error', message: err.toString() });
    }
});




app.delete('/delete-project/:projectId', async (req, res) => {
    const projectId = req.params.projectId;

    try {
      // Start transaction
      await pool.query('BEGIN');
        // Delete associated messages from the messages table
        await pool.query('DELETE FROM messages WHERE project_id = $1', [projectId]);
      // Delete the project from the projects table
      await pool.query('DELETE FROM projects WHERE project_id = $1', [projectId]);
  

  
      // Commit transaction
      await pool.query('COMMIT');
  
      res.sendStatus(200); // Send a success status code
    } catch (err) {
      // Rollback transaction in case of any error
      await pool.query('ROLLBACK');
      console.error(err);
      res.status(500).send('Failed to delete the project.'); // Send an error status code and message
    }
  });

  app.post('/subscribe', async (req, res) => {
    const email = req.body.email;
  
    if (!email) {
      return res.redirect('/?error=Email is required');
    }
  
    try {
      await pool.query('INSERT INTO emails(email) VALUES($1)', [email]);
      res.redirect('/?success=Subscription successful');
    } catch (error) {
      console.error(error);
      res.redirect('/?error=Server error');
    }
  });
  
  app.post('/sendEmail', (req, res) => {
    // Extract email data from the request
    const { sender, recipient, url } = req.body;

    let subject = "Changes made in your project!";
    let emailContent = `New content has been added to your project by: ${sender}. Check it out here ${url}`

    // Send the email notification
    sendNotificationEmail(
        recipient,
        sender,
        subject,
        emailContent
    );
});
  
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

//helpers:

const moment = require('moment-timezone');

function formatDate(dateString) {
  const date = moment.tz(dateString, "America/New_York");

  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.day()];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.month()];
  const dateOfMonth = date.date();
  const year = date.year();
  let hours = date.hours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutes = ('0' + date.minutes()).slice(-2);

  return `${day} ${month} ${dateOfMonth} ${year} ${hours}:${minutes} ${ampm}`;
}
