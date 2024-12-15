require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../database');
const { session } = require('passport');

router.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    
    res.render('pages/home');
});

router.get('/join/:kode/:email', (req, res) => {
    const { kode, email } = req.params; // Mengambil kode dan email dari URL params
  
    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [email], async (err, user) => {
        if (user.length > 0) {
            req.session.user = {
                nama: user[0].users_nama,
                email: user[0].users_email,
                instansi: user[0].users_instansi,
                peran: user[0].users_peran
            };
            
            db.query(`SELECT * FROM db_kelas WHERE kelas_kode = ?`, [kode], async (err, results) => {
                if (results.length === 0) {
                    req.session.alert = {
                        type: 'error',
                        icon: 'error',
                        message: 'Kelas tidak ditemukan.'
                    };
                    return res.redirect('/dashboard/manajemen-kelas');
                }

                db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?`, [kode, email], (err, data) => {
                    if (data.length > 0) {
                        req.session.alert = {
                            type: 'error',
                            icon: 'info',
                            message: 'Anda sudah bergabung dengan kelas ini.'
                        };
                        return res.redirect('/dashboard/manajemen-kelas');
                    }

                    if (user[0].users_peran !== 'SISWA') {
                        req.session.alert = {
                            type: 'error',
                            icon: 'info',
                            message: 'Hanya siswa yang dapat bergabung dalam kelas.'
                        };
                        return res.redirect('/dashboard/manajemen-kelas');
                    }

                    const sql = `
                        INSERT INTO db_anggota (anggota_kode, anggota_kelas, anggota_owner, anggota_nama, anggota_pembimbing, anggota_instansi, anggota_status) 
                        VALUES (?, ?, ?, ?, ?, ?, "SISWA")
                    `;
                    db.query(sql, [kode, results[0].kelas_nama, email, user[0].users_nama, results[0].kelas_pembimbing, results[0].kelas_instansi], (err, data) => {
                        req.session.alert = {
                            type: 'success',
                            icon: 'success',
                            message: 'Berhasil bergabung dengan kelas.'
                        };
                        res.redirect('/dashboard/manajemen-kelas');
                    });
                });
            });
        } else {
            req.session.alert = {
                type: 'error',
                icon: 'error',
                message: 'Akun kamu belum terdaftar.',
                email: email
            };
            return res.redirect('/login');
        }
    });
});

router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }

    res.render('pages/login', { session: req.session });
});

router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }

    res.render('pages/register');
});

router.get('/dashboard/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Failed to logout');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});


router.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error retrieving data from database');
        }
        
        if (req.session.user.peran === 'GURU') {
            res.render('pages/dashboard/guru', { user: data[0] });
        } else if (req.session.user.peran === 'SISWA') {
            res.render('pages/dashboard/siswa', { user: data[0] });
        }
    });
});

router.get('/dashboard/manajemen-kelas', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error retrieving data from database');
        }
        
        db.query(`SELECT * FROM db_anggota WHERE anggota_owner = ? AND anggota_arsip = ?`, [req.session.user.email, 0], (err, anggota) => {
            if (req.session.user.peran === 'GURU') {
                res.render('pages/dashboard/guru-manajemen-kelas', { user: data[0], anggota: anggota, session: req.session });
            } else if (req.session.user.peran === 'SISWA') {
                res.render('pages/dashboard/siswa-manajemen-kelas', { user: data[0], anggota: anggota, session: req.session });
            }
        });
    });
});

router.get('/dashboard/tugas', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error retrieving data from database');
        }
        
        if (req.session.user.peran === 'GURU') {
            res.render('pages/dashboard/tugas', { user: data[0] });
        } else if (req.session.user.peran === 'SISWA') {
            res.render('pages/dashboard/tugas', { user: data[0] });
        }
    });
});

router.get('/dashboard/pengumuman', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error retrieving data from database');
        }
        
        if (req.session.user.peran === 'GURU') {
            res.render('pages/dashboard/pengumuman', { user: data[0] });
        } else if (req.session.user.peran === 'SISWA') {
            res.render('pages/dashboard/pengumuman', { user: data[0] });
        }
    });
});

router.get('/dashboard/forum-diskusi', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error retrieving data from database');
        }
        
        if (req.session.user.peran === 'GURU') {
            res.render('pages/dashboard/forum-diskusi', { user: data[0] });
        } else if (req.session.user.peran === 'SISWA') {
            res.render('pages/dashboard/forum-diskusi', { user: data[0] });
        }
    });
});

router.get('/dashboard/arsip-kelas', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error retrieving data from database');
        }
        
        db.query(`SELECT * FROM db_anggota WHERE anggota_owner = ? AND anggota_arsip = ?`, [req.session.user.email, 1], (err, anggota) => {
            if (req.session.user.peran === 'GURU') {
                res.render('pages/dashboard/guru-arsip-kelas', { user: data[0], anggota: anggota });
            } else if (req.session.user.peran === 'SISWA') {
                res.render('pages/dashboard/siswa-arsip-kelas', { user: data[0], anggota: anggota, session: req.session });
            }
        });
    });
});

router.get('/dashboard/kelas/:kode', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        db.query(`SELECT * FROM db_kelas WHERE kelas_kode = ?`, [req.params.kode], (err, kelas) => {
            if (kelas.length === 0) {
                return res.redirect('/dashboard/manajemen-kelas');
            }
            db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ?`, [req.params.kode, req.session.user.email], (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error retrieving data from database');
                }

                const isAnggota = results.some(anggota => anggota.anggota_owner === req.session.user.email);
                if (!isAnggota) {
                    return res.redirect('/dashboard/manajemen-kelas');
                }
        
                if (req.session.user.peran === 'GURU') {
                    res.render('pages/dashboard/guru-kelas', { user: data[0], kelas: results });
                } else if (req.session.user.peran === 'SISWA') {
                    res.render('pages/dashboard/siswa-kelas', { user: data[0], kelas: results });
                }
            });
        });
    });
});

router.get('/dashboard/kelas/:kode/tugas/:tugas', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [req.session.user.email], (err, data) => {
        db.query(`SELECT * FROM db_kelas WHERE kelas_kode = ?`, [req.params.kode], (err, kelas) => {
            if (kelas.length === 0) {
                return res.redirect('/dashboard/manajemen-kelas');
            }
            db.query(`SELECT * FROM db_tugas WHERE tugas_id = ?`, ['TGS-' + req.params.tugas], (err, tugas) => {
                if (tugas.length === 0) {
                    return res.redirect(`/dashboard/kelas/${req.params.kode}`);
                }
                db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ?`, [req.params.kode, req.session.user.email], (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Error retrieving data from database');
                    }

                    const isAnggota = results.some(anggota => anggota.anggota_owner === req.session.user.email);
                    if (!isAnggota) {
                        return res.redirect('/dashboard/manajemen-kelas');
                    }
            
                    if (req.session.user.peran === 'GURU') {
                        res.render('pages/dashboard/tugas-details', { user: data[0], kelas: results, tugas: tugas[0] });
                    } else if (req.session.user.peran === 'SISWA') {
                        res.render('pages/dashboard/tugas-details', { user: data[0], kelas: results, tugas: tugas[0] });
                    }
                });
            });
        });
    });
});

router.get('/dashboardguru', (req, res) => {
    res.render('pages/dashboard/guru');
});

module.exports = router;