require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const nodemailer = require('nodemailer');
const multer = require('multer');
const db = require('../database');
const router = express.Router();

router.use(express.json());

passport.use(
    new GoogleStrategy(
        {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        },
        (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

const upload = multer({
    storage: multer.memoryStorage(), // Simpan file di memori sebagai buffer
    limits: { fileSize: 50 * 1024 * 1024 }, // Batas ukuran file (50MB)
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

function createdDate() {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${hours}:${minutes}:${seconds}`;
}

async function generateId(type) {
    let prefix;
    if (type.toLowerCase() === 'tugas') {
        prefix = 'TGS'; // ID untuk tugas
    } else if (type.toLowerCase() === 'materi') {
        prefix = 'MTI'; // ID untuk materi
    } else if (type.toLowerCase() === 'quiz') {
        prefix = 'QZ'; // ID untuk quiz
    } else {
        throw new Error('Tipe tidak dikenali'); // Jika tipe tidak dikenali
    }

    // Membuat string acak
    const randomString = Math.random().toString(36).substring(2, 7).toUpperCase(); 
    const id = `${prefix}-${randomString}`;

    // Mengecek apakah ID sudah ada di database
    const result = await new Promise((resolve, reject) => {
        db.query(`SELECT COUNT(*) AS count FROM db_${type} WHERE ${type}_id = ?`, [id], (err, result) => {
            if (err) {
                reject(err); // Menangani error
                return;
            }
            resolve(result);
        });
    });

    // Jika ID sudah ada, hasilkan ID baru dan cek lagi
    if (result[0].count > 0) {
        return await generateId(type); // Rekursif untuk mencoba ID baru
    } else {
        return id; // Jika ID unik, kembalikan ID
    }
}

router.get('/generate-kode-kelas', (req, res) => {
    function generateKodeKelas() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let kode = '';
        for (let i = 0; i < 6; i++) {
            kode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return kode;
    }

    let kodeKelas = generateKodeKelas();
    const checkKode = () => {
        db.query('SELECT COUNT(*) AS count FROM db_kelas WHERE kelas_kode = ?', [kodeKelas], (err, results) => {
            if (err) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Terjadi kesalahan pada server.',
                    error: err
                });
            }
            if (results[0].count > 0) {
                kodeKelas = generateKodeKelas();
                checkKode();
            } else {
                res.json({
                    status: 'success',
                    kode: kodeKelas,
                    message: 'Kode kelas berhasil dibuat.'
                });
            }
        });
    };
    checkKode();
});

router.get('/daftar-kelas', (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email harus disediakan.' });
    }

    // Query untuk mendapatkan kelas dan kode berdasarkan email
    const queryKelas = `
        SELECT anggota_kelas, anggota_kode 
        FROM db_anggota 
        WHERE anggota_owner = ?
    `;

    db.query(queryKelas, [email], (err, kelasResults) => {
        if (err) {
            console.error('Kesalahan query:', err);
            return res.status(500).json({ error: 'Kesalahan server.' });
        }

        // Query untuk menghitung total anggota berdasarkan kode kelas
        const queryTotal = `
            SELECT anggota_kode, COUNT(*) as total_anggota
            FROM db_anggota
            GROUP BY anggota_kode
        `;

        db.query(queryTotal, (err, totalResults) => {
            if (err) {
                console.error('Kesalahan query total:', err);
                return res.status(500).json({ error: 'Kesalahan server saat menghitung total anggota.' });
            }

            // Mapping total anggota berdasarkan anggota_kode
            const totalMap = {};
            totalResults.forEach(row => {
                totalMap[row.anggota_kode] = row.total_anggota;
            });

            // Gabungkan data kelas dan total anggota
            const response = kelasResults.map(row => ({
                kelas: row.anggota_kelas,
                kode: row.anggota_kode,
                total: totalMap[row.anggota_kode] || 0 // Total anggota berdasarkan kode kelas
            }));

            res.status(200).json(response);
        });
    });
});

router.get('/data-kelas', (req, res) => {
    const { kodeKelas } = req.query;

    // Query untuk mengambil data pengumuman
    const pengumumanQuery = `
        SELECT 
            'pengumuman' AS type,
            p.pengumuman_kode AS kelas,
            k.kelas_nama AS nama_kelas,
            p.pengumuman_text AS pengumuman,
            p.pengumuman_date_created AS dibuat,
            p.pengumuman_date_edited AS diedit,
            p.pengumuman_owner AS owner,
            u.users_nama AS nama,
            p.pengumuman_peran AS peran,
            u.users_profile AS profile
        FROM 
            db_pengumuman p
        LEFT JOIN 
            db_kelas k ON p.pengumuman_kode = k.kelas_kode
        LEFT JOIN 
            db_users u ON p.pengumuman_owner = u.users_email
        WHERE 
            p.pengumuman_kode = ?
        ORDER BY 
            p.pengumuman_date_created DESC
    `;

    // Query untuk mengambil data tugas
    const tugasQuery = `
        SELECT 
            'tugas' AS type,
            t.tugas_id AS id,
            t.tugas_kelas AS kelas,
            k.kelas_nama AS nama_kelas,
            t.tugas_judul AS judul,
            t.tugas_deskripsi AS deskripsi,
            t.tugas_created AS dibuat,
            t.tugas_deadline AS deadline,
            t.tugas_owner AS owner,
            u.users_nama AS nama,
            u.users_profile AS profile
        FROM 
            db_tugas t
        LEFT JOIN 
            db_kelas k ON t.tugas_kelas = k.kelas_kode
        LEFT JOIN 
            db_users u ON t.tugas_owner = u.users_email
        WHERE 
            t.tugas_kelas = ?
        ORDER BY 
            t.tugas_created DESC
    `;

    // Query untuk mengambil data materi
    const materiQuery = `
        SELECT 
            'materi' AS type,
            m.materi_kelas AS kelas,
            m.materi_created AS dibuat,
            m.materi_owner AS owner,
            m.materi_judul AS judul,
            m.materi_jenis AS jenis,
            m.materi_data AS data,
            u.users_nama AS nama,
            u.users_profile AS profile
        FROM 
            db_materi m
        LEFT JOIN 
            db_users u ON m.materi_owner = u.users_email
        WHERE 
            m.materi_kelas = ?
        ORDER BY 
            m.materi_created DESC
    `;

    // Eksekusi query secara paralel menggunakan Promise
    Promise.all([
        new Promise((resolve, reject) => {
            db.query(pengumumanQuery, [kodeKelas], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(tugasQuery, [kodeKelas], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(materiQuery, [kodeKelas], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        })
    ])
        .then(([pengumuman, tugas, materi]) => {
            const data = [...pengumuman, ...tugas, ...materi];
            res.status(200).json(data);
        })
        .catch(err => {
            console.error('Kesalahan query:', err);
            res.status(500).json({ error: 'Kesalahan server.' });
        });
});

router.get('/pengumuman', (req, res) => {
    // Ambil parameter kelas dari query string, jika ada
    const kelasQuery = req.query.kelas ? req.query.kelas.split(',') : [];

    // Query dasar
    let query = `
        SELECT 
            p.pengumuman_kode AS kelas,
            k.kelas_nama AS nama_kelas,
            p.pengumuman_text AS pengumuman,
            p.pengumuman_date_created AS dibuat,
            p.pengumuman_date_edited AS diedit,
            p.pengumuman_owner AS owner,
            u.users_nama AS nama,
            p.pengumuman_peran AS peran,
            u.users_profile AS profile
        FROM 
            db_pengumuman p
        LEFT JOIN 
            db_kelas k
        ON 
            p.pengumuman_kode = k.kelas_kode
        LEFT JOIN 
            db_users u
        ON 
            p.pengumuman_owner = u.users_email
    `;

    // Jika ada kelas yang diinginkan (kelasQuery) dan kelasQuery tidak kosong
    if (kelasQuery.length > 0) {
        query += ` WHERE p.pengumuman_kode IN (?)`;
    }

    // Urutkan pengumuman berdasarkan tanggal pembuatan
    query += ` ORDER BY p.pengumuman_date_created DESC`;

    // Eksekusi query
    if (kelasQuery.length > 0) {
        db.query(query, [kelasQuery], (err, results) => {
            if (err) {
                console.error('Kesalahan query:', err);
                return res.status(500).json({ error: 'Kesalahan server.' });
            }

            // Cek jika hasil query kosong
            if (results.length === 0) {
                return res.status(200).json([]);  // Mengembalikan array kosong jika tidak ada data
            }

            // Kirimkan hasil query jika ada data
            res.status(200).json(results);
        });
    } else {
        // Jika kelasQuery kosong, kembalikan array kosong tanpa menjalankan query
        res.status(200).json([]);
    }
});

router.get('/tugas', (req, res) => {
    // Ambil parameter kelas dari query string, jika ada
    const kelasQuery = req.query.kelas ? req.query.kelas.split(',') : [];

    // Query dasar
    let query = `
        SELECT 
            t.tugas_id AS id,
            t.tugas_kelas AS kelas,
            t.tugas_judul AS judul_tugas,
            t.tugas_deskripsi AS deskripsi,
            t.tugas_created AS dibuat,
            t.tugas_deadline AS deadline,
            t.tugas_owner AS owner,
            k.kelas_nama AS nama_kelas
        FROM 
            db_tugas t
        LEFT JOIN 
            db_kelas k ON t.tugas_kelas = k.kelas_kode
    `;

    // Jika ada kelas yang diinginkan (kelasQuery) dan kelasQuery tidak kosong
    if (kelasQuery.length > 0) {
        query += ` WHERE tugas_kelas IN (?)`;
    }

    // Urutkan tugas berdasarkan tanggal pembuatan
    query += ` ORDER BY tugas_created DESC`;

    // Eksekusi query
    if (kelasQuery.length > 0) {
        db.query(query, [kelasQuery], (err, results) => {
            if (err) {
                console.error('Kesalahan query:', err);
                return res.status(500).json({ error: 'Kesalahan server.' });
            }

            // Cek jika hasil query kosong
            if (results.length === 0) {
                return res.status(200).json([]);  // Mengembalikan array kosong jika tidak ada data
            }

            // Kirimkan hasil query jika ada data
            res.status(200).json(results);
        });
    } else {
        // Jika kelasQuery kosong, kembalikan array kosong tanpa menjalankan query
        res.status(200).json([]);
    }
});

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => { 
    db.query('SELECT * FROM db_users WHERE users_email = ?', [req.user._json.email], (err, data) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ status: 'error', message: 'Internal server error' });
        }

        if (data.length === 0) {
            return res.send(`
                <script>
                    window.opener.postMessage({ status: 'not found', message: 'Akun tidak ditemukan.', user: { name: '${req.user._json.name}', email: '${req.user._json.email}', profile: '${req.user._json.picture}' } }, '*');
                    window.close();
                </script>
            `);
        }

        req.session.user = {
            nama: data[0].users_nama,
            email: data[0].users_email,
            instansi: data[0].users_instansi,
            peran: data[0].users_peran
        };

        return res.send(`
            <script>
                window.opener.postMessage({ status: 'success', message: 'Login berhasil.', user: { name: '${req.user._json.name}', email: '${data[0].users_email}', peran: '${data[0].users_peran}' } }, '*');
                window.close();
            </script>
        `);
    });
});

router.get('/users/search', (req, res) => {
    let { email } = req.query; // Mendapatkan parameter email dari query string

    // Pastikan parameter email ada
    if (!email) {
        return res.status(400).json({
            status: 'error',
            message: 'Harap memberikan daftar email yang valid.'
        });
    }

    // Pisahkan email yang dipisahkan koma menjadi array
    email = email.split(',').map(e => e.replace(/"/g, '').trim());

    // Pastikan format email adalah array dan tidak kosong
    if (email.length === 0 || email.some(e => !e)) {
        return res.status(400).json({
            status: 'error',
            message: 'Harap memberikan daftar email yang valid.'
        });
    }

    // Menjalankan query dengan array email sebagai parameter
    db.query('SELECT * FROM db_users WHERE users_email IN (?)', [email], (err, results) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan saat mencari data user.'
            });
        }

        // Jika tidak ada data ditemukan
        if (results.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Tidak ada user ditemukan dengan email yang diberikan.'
            });
        }

        // Mengembalikan data user
        return res.status(200).json({
            status: 'success',
            data: results, // Mengembalikan data user yang ditemukan
        });
    });
});

router.get('/users/register', async (req, res) => {
    const { profile, nama, email, password, peran, jenjang, instansi } = req.query;

    if (!nama || !email || !password || !peran || !jenjang || !instansi) {
        return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [email], async (err, results) => {
        if (err) {
            console.error('Error checking database:', err);
            return res.status(500).json({ status: 'error', message: 'Registrasi Gagal, Silahkan coba lagi.' });
        }

        if (results.length > 0) {
            return res.status(400).json({ status: 'duplicate', message: 'Email sudah terdaftar.' });
        }

        const hashPassword = await bcrypt.hash(password, 10);
        const sql = `
            INSERT INTO db_users (users_profile, users_nama, users_email, users_password, users_peran, users_jenjang, users_instansi) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(sql, [profile, nama, email, hashPassword, peran, jenjang, instansi], (err, data) => {
            if (err) {
                console.error('Error inserting data:', err);
                return res.status(500).json({ status: 'error', message: 'Registrasi Gagal, Silahkan coba lagi.' });
            }

            res.status(201).json({
                status: 'success',
                message: 'Registrasi akun berhasil.',
                data: {
                    nama: nama,
                    email: email,
                    peran: peran
                }
            });
        });
    });
});

router.get('/users/login', async (req, res) => {
    const { email, password, remember } = req.query;

    if (!email || !password) {
        return res.status(400).json({ status: 'error', message: 'Email dan Password wajib diisi!' });
    }

    db.query(`SELECT * FROM db_users WHERE users_email = ?`, [email], async (err, data) => {
        if (err) {
            console.error('Error checking database:', err);
            return res.status(500).json({ status: 'error', message: 'Login Gagal, Silahkan coba lagi.' });
        }

        if (data.length === 0) {
            return res.status(400).json({ status: 'not found', message: 'Email belum terdaftar.' });
        }

        const match = await bcrypt.compare(password, data[0].users_password);
        if (!match) {
            return res.status(400).json({ status: 'wrong password', message: 'Password yang Anda masukkan salah.' });
        }

        req.session.user = {
            nama: data[0].users_nama,
            email: data[0].users_email,
            instansi: data[0].users_instansi,
            peran: data[0].users_peran
        };

        if (remember) {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 3); 

            res.cookie('user', {
                email: data[0].users_email,
                peran: data[0].users_peran
            }, { expires: expirationDate, httpOnly: true, secure: false }); 
        }
        
        res.status(200).json({
            status: 'success',
            message: 'Login berhasil.',
            data: {
                nama: data[0].users_nama,
                email: data[0].users_email,
                peran: data[0].users_peran
            }
        });
    });
});

router.get('/instansi', (req, res) => {
    const searchTerm = req.query.q || '';  // Get the search term (instansi name)
    const jenjang = req.query.jenjang || ''; // Get the jenjang filter
    
    // Initialize queryParts and queryParams arrays
    const queryParts = ['instansi_nama LIKE ?'];  // Base condition for searching instansi name
    const queryParams = [`%${searchTerm}%`];  // Search term for instansi name
    
    // If jenjang is provided, add it to the query filter
    if (jenjang) {
        queryParts.push('instansi_jenjang = ?');
        queryParams.push(jenjang);
    }
    
    // Join all query parts with AND for multiple conditions
    const finalQuery = `SELECT * FROM db_instansi WHERE ${queryParts.join(' AND ')}`;
    
    // Execute the query
    db.query(finalQuery, queryParams, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

router.get('/instansi/register', async (req, res) => {
    const { instansi, jenjang, email, telepon, alamat, website} = req.query;

    if (!instansi || !jenjang || !email || !telepon || !alamat) {
        return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
    }

    db.query(`SELECT * FROM db_instansi WHERE instansi_nama = ?`, [instansi], async (err, results) => {
        if (err) {
            console.error('Error checking database:', err);
            return res.status(500).json({ status: 'error', message: 'Registrasi Gagal, Silahkan coba lagi.' });
        }

        if (results.length > 0) {
            return res.status(400).json({ status: 'duplicate', message: 'Organisasi/Instansi/Sekolah sudah terdaftar.' });
        }

        const sql = `
            INSERT INTO db_instansi (instansi_nama, instansi_jenjang, instansi_email, instansi_telepon, instansi_alamat, instansi_website) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(sql, [instansi.toUpperCase(), jenjang, email, telepon, alamat, website], async (err, data) => {
            if (err) {
                console.error('Error inserting data:', err);
                return res.status(500).json({ status: 'error', message: 'Registrasi Gagal, Silahkan coba lagi.' });
            }

            // Detail email
            const mailOptions = {
                from: 'eduplatform@gmail.com', // Email pengirim
                to: email, // Email penerima
                subject: 'Registrasi Berhasil - EduPlatform',
                html: `
                    <p>Halo ${instansi},<br>Terima kasih telah mendaftarkan instansi Anda (${jenjang}) di sistem kami.</p>
                    <p>Detail yang telah Anda daftarkan:</p>
                    <ul>
                        <li><strong>Nama Instansi:</strong> ${instansi}</li>
                        <li><strong>Jenjang:</strong> ${jenjang}</li>
                        <li><strong>Alamat:</strong> ${alamat}</li>
                        <li><strong>Telepon:</strong> ${telepon}</li>
                        <li><strong>Website:</strong> ${website || '-'}</li>
                    </ul>
                    <p>Salam, Tim Kami</p>
                `
            };
    
            try {
                // Kirim email
                await transporter.sendMail(mailOptions);

                res.status(201).json({
                    status: 'success',
                    message: 'Registrasi berhasil.',
                    data: {
                        instansi: instansi,
                        jenjang: jenjang,
                        alamat: alamat
                    }
                });
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                res.status(500).json({
                    status: 'error',
                    message: 'Registrasi berhasil.',
                    data: {
                        instansi: instansi,
                        jenjang: jenjang,
                        alamat: alamat
                    }
                });
            }
        });
    });
});

router.get('/kelas/search', (req, res) => {
    let { kode } = req.query; // Mendapatkan parameter email dari query string

    // Pastikan parameter email ada
    if (!kode) {
        return res.status(400).json({
            status: 'error',
            message: 'Harap memberikan kode yang valid.'
        });
    }

    // Menjalankan query dengan array email sebagai parameter
    db.query('SELECT * FROM db_kelas WHERE kelas_kode = ?', [kode], (err, results) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan saat mencari kelas.'
            });
        }

        // Jika tidak ada data ditemukan
        if (results.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Tidak ada kelas ditemukan dengan kode yang diberikan.'
            });
        }

        // Mengembalikan data user
        return res.status(200).json({
            status: 'success',
            data: results, // Mengembalikan data user yang ditemukan
        });
    });
});

router.get('/kelas/invite', (req, res) => {
    const { email, kode } = req.query; // Mengambil email dan nama kelas dari body request
  
    if (!email || !kode) {
      return res.status(400).json({ message: 'Email dan nama kelas harus disediakan' });
    }

    db.query('SELECT * FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?', [kode, email], (err, results) => {
        if (results.length > 0) {
            return res.status(400).json({ status: 'duplicate', message: 'Anggota sudah bergabung dalam kelas.' });
        }

        db.query('SELECT * FROM db_kelas WHERE kelas_kode = ?', [kode], (err, data) => {
            const mailOptions = {
                from: 'eduplatform@gmail.com', // Ganti dengan email Anda
                to: email, // Email penerima
                subject: `Undangan Kelas - EduPlatform`,
                html: `
                        Halo, Anda diundang untuk bergabung ke kelas <b>${data[0].kelas_nama}</b>.<br>
                        Silakan klik link berikut untuk bergabung:<br><br>
                        https://f799-110-139-92-111.ngrok-free.app/join/${kode}/${email}<br><br>
                        Terima kasih!
                `};
        
            // Mengirim email
            transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Gagal mengirim email', error: err });
            }
            res.status(200).json({ status: 'success', message: 'Undangan berhasil dikirim', info });
            });
        });
    });
});

router.get('/kelas/create', async (req, res) => {
    const { nama, desk, kode } = req.query;

    if (!nama || !desk || !kode ) {
        return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
    }

    db.query(`SELECT * FROM db_kelas WHERE kelas_nama = ? AND kelas_owner = ?`, [nama, req.session.user?.email], async (err, results) => {
        if (err) {
            console.error('Error checking database:', err);
            return res.status(500).json({ status: 'error', message: 'Kelas gagal dibuat, Silahkan coba lagi.' });
        }

        if (results.length > 0) {
            return res.status(400).json({ status: 'duplicate', message: 'Nama Kelas sudah ada.' });
        }

        const sql = `
            INSERT INTO db_kelas (kelas_kode, kelas_owner, kelas_nama, kelas_deskripsi, kelas_pembimbing, kelas_instansi) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.query(sql, [kode, req.session.user?.email, nama, desk, req.session.user?.email, req.session.user?.instansi], (err, results) => {
            if (err) {
                console.error('Error inserting data:', err);
                return res.status(500).json({ status: 'error', message: 'Kelas gagal dibuat, Silahkan coba lagi.' });
            }
            const sql = `
                INSERT INTO db_anggota (anggota_kode, anggota_kelas, anggota_deskripsi, anggota_owner, anggota_nama, anggota_pembimbing, anggota_instansi, anggota_status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, "GURU")
            `;
            db.query(sql, [kode, nama, desk, req.session.user?.email, req.session.user?.nama, req.session.user?.email, req.session.user?.instansi], (err, data) => {
                if (err) {
                    console.error('Error inserting student enrollment:', err);
                    return res.status(500).json({ status: 'error', message: 'Gagal bergabung dengan kelas, Silahkan coba lagi.' });
                }

                res.status(201).json({
                    status: 'success',
                    message: 'Kelas berhasil dibuat.',
                    data: {
                        kode: kode,
                        owner: req.session.user?.email,
                        nama: nama,
                        instansi: req.session.user?.instansi
                    }
                });
            });
        });
    });
});

router.get('/kelas/action', async (req, res) => {
    const { nama, desk, kode, owner, action } = req.query;

    if (!kode) {
        return res.status(400).json({ status: 'error', message: 'Kode wajib diisi!' });
    }
    
    db.query(`SELECT * FROM db_kelas WHERE kelas_kode = ? `, [kode], (err, results) => {
        if (err) {
            console.error('Error checking database:', err); 
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan.' });
        }

        if (action == "edit") {
            if (!nama || !desk) {
                return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
            }

            db.query(`UPDATE db_kelas SET kelas_nama = ?, kelas_deskripsi = ? WHERE kelas_kode = ?`, [nama, desk, kode], (err, data) => {
                db.query(`UPDATE db_anggota SET anggota_kelas = ?, anggota_deskripsi = ? WHERE anggota_kode = ?`, [nama, desk, kode], (err, data) => {
                    if (err) {
                        console.error('Error updating data:', err);
                        return res.status(500).json({ status: 'error', message: 'Kelas gagal diperbarui, silahkan coba lagi.' });
                    }
        
                    res.status(200).json({
                        status: 'success',
                        message: 'Kelas berhasil diperbarui.',
                        data: {
                            kode: kode,
                            owner: req.session.user?.email,
                            nama: nama,
                            deskripsi: desk,
                            instansi: req.session.user?.instansi
                        }
                    });
                });
            });
        } else if (action == "arsip") {
            if (!owner) {
                return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
            }
    
            db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?`, [kode, owner], (err, data) => {
                if (err) {
                    console.error('Error checking database:', err);
                    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
                }
    
                if (data.length > 0) {
                    db.query(`UPDATE db_anggota SET anggota_arsip = ? WHERE anggota_kode = ? AND anggota_owner = ?`, [1, kode, owner], (err, data) => {
                        if (err) {
                            console.error('Error updating data:', err);
                            return res.status(500).json({ status: 'error', message: 'Kelas gagal diperbarui, silahkan coba lagi.' });
                        }
            
                        res.status(200).json({
                            status: 'success',
                            message: `Kelas "${nama}" ditambahkan kedalam daftar arsip.`,
                            data: {
                                kode: kode,
                                nama: nama,
                                owner: req.session.user?.email,
                                arsip: true
                            }
                        });
                    });
                }
            });
        } else if (action == "pulihkan") {
            if (!owner) {
                return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
            }
    
            db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?`, [kode, owner], (err, data) => {
                if (err) {
                    console.error('Error checking database:', err);
                    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
                }
    
                if (data.length > 0) {
                    db.query(`UPDATE db_anggota SET anggota_arsip = ? WHERE anggota_kode = ? AND anggota_owner = ?`, [0, kode, owner], (err, data) => {
                        if (err) {
                            console.error('Error updating data:', err);
                            return res.status(500).json({ status: 'error', message: 'Kelas gagal diperbarui, silahkan coba lagi.' });
                        }
            
                        res.status(200).json({
                            status: 'success',
                            message: `Kelas "${nama}" telah dipulihkan.`,
                            data: {
                                kode: kode,
                                nama: nama,
                                owner: req.session.user?.email,
                                arsip: true
                            }
                        });
                    });
                }
            });
        } else if (action == "delete_guru") {
            if (!owner) {
                return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
            }
        
            db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?`, [kode, owner], (err, data) => {
                if (err) {
                    console.error('Error checking database:', err);
                    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
                }
        
                if (data.length > 0) {
                    db.query(`DELETE FROM db_anggota WHERE anggota_kode = ?`, [kode], (err) => {
                        if (err) {
                            console.error('Error deleting anggota:', err);
                            return res.status(500).json({ status: 'error', message: 'Gagal menghapus anggota kelas.' });
                        }
                        db.query(`DELETE FROM db_pengumuman WHERE pengumuman_kode = ?`, [kode]);
                        db.query(`DELETE FROM db_diskusi WHERE diskusi_id = ?`, [kode])
                        db.query(`DELETE FROM db_kelas WHERE kelas_kode = ?`, [kode], (err) => {
                            if (err) {
                                console.error('Error deleting kelas:', err);
                                return res.status(500).json({ status: 'error', message: 'Gagal menghapus kelas.' });
                            }
        
                            res.status(200).json({
                                status: 'success',
                                message: `Kelas "${nama}" telah dihapus.`,
                                data: {
                                    kode: kode,
                                    nama: nama,
                                    owner: req.session.user?.email 
                                }
                            });
                        });
                    });
                }
            });
        } else if (action == "delete_siswa") {
            if (!owner) {
                return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
            }
        
            db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?`, [kode, owner], (err, data) => {
                if (err) {
                    console.error('Error checking database:', err);
                    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
                }
        
                if (data.length > 0) {
                    db.query(`DELETE FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?`, [kode, owner], (err) => {
                        if (err) {
                            console.error('Error deleting anggota:', err);
                            return res.status(500).json({ status: 'error', message: 'Gagal menghapus anggota kelas.' });
                        }
        
                        res.status(200).json({
                            status: 'success',
                            message: `Kelas "${nama}" telah dihapus.`,
                            data: {
                                kode: kode,
                                nama: nama,
                                owner: req.session.user?.email 
                            }
                        });
                    });
                }
            });
        }
    });
});

router.get('/kelas/join', async (req, res) => {
    const { kode } = req.query;

    if (!kode) {
        return res.status(400).json({ status: 'error', message: 'Kode kelas wajib diisi!' });
    }

    // Periksa apakah kelas dengan kode yang diberikan ada
    db.query(`SELECT * FROM db_kelas WHERE BINARY kelas_kode = ?`, [kode], async (err, results) => {
        if (err) {
            console.error('Error checking database:', err);
            return res.status(500).json({ status: 'error', message: 'Gagal memeriksa kelas, Silahkan coba lagi.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'not found', message: 'Kelas tidak ditemukan.' });
        }

        // Periksa apakah siswa sudah bergabung dengan kelas tersebut
        db.query(`SELECT * FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?`, [kode, req.session.user?.email], (err, data) => {
            if (err) {
                console.error('Error checking student enrollment:', err);
                return res.status(500).json({ status: 'error', message: 'Gagal memeriksa pendaftaran siswa, Silahkan coba lagi.' });
            }

            if (data.length > 0) {
                return res.status(400).json({ status: 'duplicate', message: 'Anda sudah bergabung dengan kelas ini.' });
            }

            // Menambahkan siswa ke dalam kelas
            const sql = `
                INSERT INTO db_anggota (anggota_kode, anggota_kelas, anggota_deskripsi, anggota_owner, anggota_nama, anggota_pembimbing, anggota_instansi, anggota_status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, "SISWA")
            `;
            db.query(sql, [kode, results[0].kelas_nama, results[0].kelas_deskripsi, req.session.user?.email, req.session.user?.nama, results[0].kelas_pembimbing, results[0].kelas_instansi], (err, data) => {
                if (err) {
                    console.error('Error inserting student enrollment:', err);
                    return res.status(500).json({ status: 'error', message: 'Gagal bergabung dengan kelas, Silahkan coba lagi.' });
                }

                res.status(201).json({
                    status: 'success',
                    message: 'Anda berhasil bergabung dengan kelas.',
                    data: {
                        kode: kode,
                        kelas_nama: results[0].kelas_nama,
                        instansi: results[0].kelas_instansi
                    }
                });
            });
        });
    });
});

router.get('/anggota/status', (req, res) => {
    let { kode, owner, action } = req.query; // Mendapatkan parameter kode dan owner dari query string

    // Pastikan parameter kode dan owner ada
    if (!kode || !owner || !action) {
        return res.status(400).json({
            status: 'error',
            message: 'Harap memberikan kode, owner dan action yang valid.'
        });
    }

    db.query(`SELECT * FROM db_kelas WHERE kelas_kode = ?`, [kode], async (err, data) => {
        if (action == "upgrade") {
            const pembimbingOld = data[0].kelas_pembimbing;
            const pembimbingArray = pembimbingOld.split(", ").map(email => email.trim());
            if (!pembimbingArray.includes(owner)) {
                pembimbingArray.push(owner);
            }
            const pembimbing = pembimbingArray.join(", ");

            db.query(`UPDATE db_anggota SET anggota_status = ? WHERE anggota_kode = ? AND anggota_owner = ?`, ["GURU", kode, owner], (err, results) => {
                if (err) {
                    console.error('Error:', err);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Terjadi kesalahan saat menghapus data kelas.'
                    });
                }
        
                // Mengecek apakah ada baris yang dihapus
                if (results.affectedRows === 0) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Tidak ada siswa ditemukan dengan kode dan owner yang diberikan.'
                    });
                }
                db.query(`UPDATE db_kelas SET kelas_pembimbing = ? WHERE kelas_kode = ?`, [pembimbing, kode])
                db.query(`UPDATE db_anggota SET anggota_pembimbing = ? WHERE anggota_kode = ?`, [pembimbing, kode])
                // Mengembalikan respons sukses setelah data berhasil dihapus
                return res.status(200).json({
                    status: 'success',
                    message: 'Anggota berhasil diubah sebagai pembimbing.'
                });
            });
        } else if (action == "downgrade") {
            const pembimbingOld = data[0].kelas_pembimbing;
            const pembimbingArray = pembimbingOld.split(", ").map(email => email.trim());
            const indexToRemove = pembimbingArray.indexOf(owner);
            if (indexToRemove !== -1) {
                pembimbingArray.splice(indexToRemove, 1);
            }
            const pembimbing = pembimbingArray.join(", ");

            db.query(`UPDATE db_anggota SET anggota_status = ? WHERE anggota_kode = ? AND anggota_owner = ?`, ["SISWA", kode, owner], (err, results) => {
                if (err) {
                    console.error('Error:', err);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Terjadi kesalahan saat menghapus data kelas.'
                    });
                }
        
                // Mengecek apakah ada baris yang dihapus
                if (results.affectedRows === 0) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Tidak ada siswa ditemukan dengan kode dan owner yang diberikan.'
                    });
                }
                db.query(`UPDATE db_kelas SET kelas_pembimbing = ? WHERE kelas_kode = ?`, [pembimbing, kode])
                db.query(`UPDATE db_anggota SET anggota_pembimbing = ? WHERE anggota_kode = ?`, [pembimbing, kode])
                // Mengembalikan respons sukses setelah data berhasil dihapus
                return res.status(200).json({
                    status: 'success',
                    message: 'Anggota berhasil diubah sebagai siswa.'
                });
            });
        } else if (action == "delete") {
            const pembimbingOld = data[0].kelas_pembimbing;
            const pembimbingArray = pembimbingOld.split(", ").map(email => email.trim());
            const indexToRemove = pembimbingArray.indexOf(owner);
            if (indexToRemove !== -1) {
                pembimbingArray.splice(indexToRemove, 1);
            }
            const pembimbing = pembimbingArray.join(", ");
            db.query('DELETE FROM db_anggota WHERE anggota_kode = ? AND anggota_owner = ?', [kode, owner], (err, results) => {
                if (err) {
                    console.error('Error:', err);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Terjadi kesalahan saat menghapus data kelas.'
                    });
                }
        
                // Mengecek apakah ada baris yang dihapus
                if (results.affectedRows === 0) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Tidak ada kelas ditemukan dengan kode dan owner yang diberikan.'
                    });
                }
                db.query(`UPDATE db_kelas SET kelas_pembimbing = ? WHERE kelas_kode = ?`, [pembimbing, kode])
                db.query(`UPDATE db_anggota SET anggota_pembimbing = ? WHERE anggota_kode = ?`, [pembimbing, kode]) 
                return res.status(200).json({
                    status: 'success',
                    message: 'Anggota berhasil dihapus.'
                });
            });
        }
    });
});

router.post('/pengumuman/create', async (req, res) => {
    const { kode, pengumuman } = req.body;
    
    if (!kode || !pengumuman) {
        return res.status(400).json({ status: 'error', message: 'Pengumuman dan kode kelas wajib diisi!' });
    }

    db.query(`SELECT * FROM db_kelas WHERE kelas_kode = ?`, [kode], async (err, results) => {
        if (err) {
            console.error('Error checking database:', err);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan.' });
        }

        const sql = `
            INSERT INTO db_pengumuman (pengumuman_kode, pengumuman_text, pengumuman_date_created, pengumuman_owner, pengumuman_peran) 
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(sql, [kode, pengumuman, createdDate(), req.session.user?.email, req.session.user?.peran], (err, results) => {
            if (err) {
                console.error('Error inserting announcement:', err);
                return res.status(500).json({ status: 'error', message: 'Pengumuman gagal dibuat, silahkan coba lagi.' });
            }

            res.status(201).json({
                status: 'success',
                message: 'Pengumuman berhasil dibuat.',
                data: {
                    kode: kode,
                    owner: req.session.user?.email,
                    pengumuman: pengumuman,
                    createdDate: createdDate()
                }
            });
        });
    });
});

router.get('/diskusi', (req, res) => {
    const { id } = req.query; // Mengambil id dari query string

    if (!id) {
        return res.status(400).json({ error: 'id is required' });
    }

    // Query SQL untuk mengambil data diskusi berdasarkan id
    const query = `
        SELECT 
            d.diskusi_id AS id, 
            d.diskusi_email AS owner, 
            d.diskusi_pesan AS pesan, 
            d.diskusi_date AS tanggal, 
            u.users_nama AS nama, 
            u.users_profile AS profile,
            u.users_peran AS peran
        FROM 
            db_diskusi d
        LEFT JOIN 
            db_users u ON d.diskusi_email = u.users_email
        WHERE 
            d.diskusi_id = ?
        ORDER BY
            d.diskusi_date ASC
    `;

    // Menjalankan query untuk mengambil data diskusi berdasarkan id
    db.query(query, [id], (err, results) => {
        // Menampilkan data diskusi
        res.status(200).json(results);
    });
});

router.get('/diskusi/send', async (req, res) => {
    const { kode, email, pesan } = req.query;

    if (!kode || !email || !pesan ) {
        return res.status(400).json({ status: 'error', message: 'Semua kolom wajib diisi!' });
    }

    const sql = `
        INSERT INTO db_diskusi (diskusi_id, diskusi_email, diskusi_pesan, diskusi_date) 
        VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [kode, email, pesan, createdDate()], (err, results) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ status: 'error', message: 'Pesan gagal dibuat, Silahkan coba lagi.' });
        }
        res.status(201).json({
            status: 'success',
            message: 'Pesan berhasil dibuat.',
            data: {
                id: kode,
                owner: email,
                pesan: pesan,
                date: createdDate()
            }
        });
    });
});

router.post('/upload-materi', upload.single('content'), (req, res) => {
    const { kelas, nama, option, content } = req.body; // Mengambil data dari form

    // Jika materi berupa file
    if (option === 'file' && req.file) {
        const fileBuffer = req.file.buffer; // File content dalam bentuk BLOB
        const fileName = req.file.originalname; // Nama asli file

        db.query(
            'INSERT INTO db_materi (materi_kelas, materi_created, materi_owner, materi_judul, materi_jenis, materi_data, materi_filename) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [kelas, createdDate(), req.session.user?.email, nama, option, fileBuffer, fileName],
            (err, result) => {
                if (err) {
                    console.error('Error saving file to database:', err);
                    return res.status(500).json({ error: 'Materi gagal diupload' });
                }
                console.log('File berhasil disimpan ke database');
                return res.json({ status: 'success', message: 'Materi berhasil diupload' });
            }
        );
    } else if (option === 'link' && content) {
        db.query(
            'INSERT INTO db_materi (materi_kelas, materi_created, materi_owner, materi_judul, materi_jenis, materi_data) VALUES (?, ?, ?, ?, ?, ?)',
            [kelas, createdDate(), req.session.user?.email, nama, option, content],
            (err, result) => {
                if (err) {
                    console.error('Error saving link to database:', err);
                    return res.status(500).json({ error: 'Materi gagal diupload' });
                }
                console.log('Link berhasil disimpan ke database');
                return res.json({ status: 'success', message: 'Materi berhasil diupload' });
            }
        );
    } else {
        res.status(400).json({ error: 'Materi tidak valid atau data kosong' });
    }
});

router.post('/upload-quiz', upload.single('content'), (req, res) => {
    const { kelas, nama, option, content } = req.body; // Mengambil data dari form

    // Jika kuis berupa file
    if (option === 'file' && req.file) {
        const fileBuffer = req.file.buffer; // File content dalam bentuk BLOB
        const fileName = req.file.originalname; // Nama asli file

        db.query(
            'INSERT INTO db_quiz (quiz_kelas, quiz_created, quiz_owner, quiz_judul, quiz_jenis, quiz_data, quiz_filename) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [kelas, createdDate(), req.session.user?.email, nama, option, fileBuffer, fileName],
            (err, result) => {
                if (err) {
                    console.error('Error saving file to database:', err);
                    return res.status(500).json({ error: 'Quiz gagal diupload' });
                }
                console.log('File kuis berhasil disimpan ke database');
                return res.json({ status: 'success', message: 'Quiz berhasil diupload' });
            }
        );
    } else if (option === 'link' && content) {
        db.query(
            'INSERT INTO db_quiz (quiz_kelas, quiz_created, quiz_owner, quiz_judul, quiz_jenis, quiz_data) VALUES (?, ?, ?, ?, ?, ?)',
            [kelas, createdDate(), req.session.user?.email, nama, option, content],
            (err, result) => {
                if (err) {
                    console.error('Error saving link to database:', err);
                    return res.status(500).json({ error: 'Quiz gagal diupload' });
                }
                console.log('Link kuis berhasil disimpan ke database');
                return res.json({ status: 'success', message: 'Quiz berhasil diupload' });
            }
        );
    } else {
        res.status(400).json({ error: 'Kuis tidak valid atau data kosong' });
    }
});

router.post('/upload-tugas', upload.single('content'), async (req, res) => {
    const { kelas, nama, deadline, deskripsi, content } = req.body; // Mengambil data dari form
    const id = await generateId('tugas');
    const fileBuffer = req.file.buffer; 
    const fileName = req.file.originalname;

    const date = new Date(deadline);
    const deadlineDate = `${date.getDate()} ${getMonthName(date.getMonth())} ${date.getFullYear()}, ${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}`;
    function getMonthName(monthIndex) {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return months[monthIndex];
    }
    function padTime(num) {
        return num < 10 ? `0${num}` : num;
    }

    db.query(
        'INSERT INTO db_tugas (tugas_id, tugas_kelas, tugas_owner, tugas_judul, tugas_deskripsi, tugas_created, tugas_deadline, tugas_data, tugas_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, kelas, req.session.user?.email, nama, deskripsi, createdDate(), deadlineDate, fileBuffer, fileName],
        (err, result) => {
            if (err) {
                console.error('Error saving file to database:', err);
                return res.status(500).json({ error: 'Gagal membuat tugas' });
            }
            console.log('File Tugas berhasil disimpan ke database');
            return res.json({ status: 'success', message: 'Tugas berhasil diunggah' });
        }
    );
});

router.post('/upload-tugas/siswa', upload.single('content'), async (req, res) => {
    const { id, kelas, option, content } = req.body; // Mengambil data dari form

    // Jika kuis berupa file
    if (option === 'file' && req.file) {
        const fileBuffer = req.file.buffer; // File content dalam bentuk BLOB
        const fileName = req.file.originalname; // Nama asli file
    
        db.query(
            'INSERT INTO db_tugas_siswa (tugas_id, tugas_kelas, tugas_owner, tugas_created, tugas_data, tugas_filename, tugas_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, kelas, req.session.user?.email, createdDate(), fileBuffer, fileName, 'selesai'],
            (err, result) => {
                if (err) {
                    console.error('Error saving file to database:', err);
                    return res.status(500).json({ error: 'Tugas gagal diupload' });
                }
                console.log('File tugas berhasil disimpan ke database');
                return res.json({ status: 'success', message: 'Tugas berhasil diupload' });
            }
        );
    } else {
        db.query(
            'INSERT INTO db_tugas_siswa (tugas_id, tugas_kelas, tugas_owner, tugas_created, tugas_data, tugas_status) VALUES (?, ?, ?, ?, ?, ?)',
            [id, kelas, req.session.user?.email, createdDate(), content, 'selesai'],
            (err, result) => {
                if (err) {
                    console.error('Error saving link to database:', err);
                    return res.status(500).json({ error: 'Tugas gagal diupload' });
                }
                console.log('Link tugas berhasil disimpan ke database');
                return res.json({ status: 'success', message: 'Tugas berhasil diupload' });
            }
        );
    }
});

// router.post('/upload-tugas/siswa', upload.single('content'), async (req, res) => {
//     const { kelas, option, content } = req.body; // Mengambil data dari form

//     // Jika kuis berupa file
//     if (option === 'file' && req.file) {
//         const fileBuffer = req.file.buffer; // File content dalam bentuk BLOB
//         const fileName = req.file.originalname; // Nama asli file
    
//         db.query(
//             'INSERT INTO db_tugas-siswa (tugas_id, tugas_kelas, tugas_owner, tugas_created, tugas_data, tugas_filename, tugas_status, tugas_nilai) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
//             [id, kelas, req.session.user?.email, createdDate(), fileBuffer, fileName, 'belum selesai', '0'],
//             (err, result) => {
//                 if (err) {
//                     console.error('Error saving file to database:', err);
//                     return res.status(500).json({ error: 'Tugas gagal diupload' });
//                 }
//                 console.log('File tugas berhasil disimpan ke database');
//                 return res.json({ status: 'success', message: 'Tugas berhasil diupload' });
//             }
//         );
//     } else {
//         db.query(
//             'INSERT INTO db_tugas-siswa (tugas_id, tugas_kelas, tugas_owner, tugas_created, tugas_data, tugas_status, tugas_nilai) VALUES (?, ?, ?, ?, ?, ?, ?)',
//             [id, kelas, req.session.user?.email, createdDate(), content, 'belum selesai', '0'],
//             (err, result) => {
//                 if (err) {
//                     console.error('Error saving link to database:', err);
//                     return res.status(500).json({ error: 'Tugas gagal diupload' });
//                 }
//                 console.log('Link tugas berhasil disimpan ke database');
//                 return res.json({ status: 'success', message: 'Tugas berhasil diupload' });
//             }
//         );
//     }
// });

module.exports = router;