var oracledb = require('oracledb');
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
var config = require('../ConfigData/database');
 
 function post(req, res, next) {
    var user = {
        email: req.body.email
    };
    var unhashedPassword = req.body.password;

    console.log(req.body.email+' - '+req.body.password);
 
    bcrypt.genSalt(10, function(err, salt) {
        if (err) {
            return next(err);
        }
 
        bcrypt.hash(unhashedPassword, salt, function(err, hash) {
            if (err) {
                return next(err);
            }
 
            user.hashedPassword = hash;
            console.log(user.hashedPassword);
 
            insertUser(user, function(err, user) {
                var payload;
 
                if (err) {
                    return next(err);
                }
 
                payload = {
                    sub: user.email,
                    role: user.role
                };
 
                res.status(200).json({
                    user: user,
                    token: jwt.sign(payload, config.jwtSecretKey, {expiresIn: 360})
                });
            });
        });
    });
}
 
module.exports.post = post;
 
function insertUser(user, cb) {
    oracledb.getConnection(
        config.hrPool,
        function(err, connection){
            if (err) {
                return cb(err);
            }
 
            connection.execute(
                `insert into jsao_users ( 
                   email, 
                   password, 
                   role 
                ) 
                values (
                    :email, 
                    :password, 
                    \'BASE\' 
                ) 
                returning 
                   id, 
                   email, 
                   role 
                into 
                   :rid, 
                   :remail, 
                   :rrole`,
                {
                    email: user.email.toLowerCase(),
                    password: user.hashedPassword,
                    rid: {
                        type: oracledb.NUMBER,
                        dir: oracledb.BIND_OUT
                    },
                    remail: {
                        type: oracledb.STRING,
                        dir: oracledb.BIND_OUT
                    },
                    rrole: {
                        type: oracledb.STRING,
                        dir: oracledb.BIND_OUT
                    }
 
                },
                {
                    autoCommit: true
                },
                function(err, results){
                    if (err) {
                        connection.release(function(err) {
                            if (err) {
                                console.error(err.message);
                            }
                        });
 
                        return cb(err);
                    }

                    console.log(results.outBinds);
 
                    cb(null, {
                        id: results.outBinds.rid[0],
                        email: results.outBinds.remail[0],
                        role: results.outBinds.rrole[0]
                    });
 
                    connection.release(function(err) {
                        if (err) {
                            console.error(err.message);
                        }
                    });
                });
        }
    );
}