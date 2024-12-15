-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 15 Des 2024 pada 17.27
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `education`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_anggota`
--

CREATE TABLE `db_anggota` (
  `anggota_kode` varchar(221) NOT NULL,
  `anggota_kelas` varchar(1001) NOT NULL,
  `anggota_deskripsi` varchar(150) NOT NULL,
  `anggota_owner` varchar(221) NOT NULL,
  `anggota_nama` varchar(221) NOT NULL,
  `anggota_pembimbing` varchar(9999) NOT NULL,
  `anggota_instansi` varchar(221) NOT NULL,
  `anggota_status` varchar(22) NOT NULL,
  `anggota_arsip` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_diskusi`
--

CREATE TABLE `db_diskusi` (
  `diskusi_id` varchar(1001) NOT NULL,
  `diskusi_email` varchar(221) NOT NULL,
  `diskusi_pesan` varchar(2000) NOT NULL,
  `diskusi_date` varchar(55) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_instansi`
--

CREATE TABLE `db_instansi` (
  `instansi_nama` varchar(221) NOT NULL,
  `instansi_jenjang` varchar(221) NOT NULL,
  `instansi_email` varchar(221) NOT NULL,
  `instansi_telepon` int(221) NOT NULL,
  `instansi_alamat` varchar(221) NOT NULL,
  `instansi_website` varchar(221) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_kelas`
--

CREATE TABLE `db_kelas` (
  `kelas_kode` varchar(221) NOT NULL,
  `kelas_owner` varchar(221) NOT NULL,
  `kelas_nama` varchar(221) NOT NULL,
  `kelas_deskripsi` varchar(150) NOT NULL,
  `kelas_pembimbing` varchar(9999) NOT NULL,
  `kelas_instansi` varchar(221) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_materi`
--

CREATE TABLE `db_materi` (
  `materi_kelas` varchar(221) NOT NULL,
  `materi_created` varchar(221) NOT NULL,
  `materi_owner` varchar(221) NOT NULL,
  `materi_judul` varchar(221) NOT NULL,
  `materi_jenis` varchar(221) NOT NULL,
  `materi_data` longblob NOT NULL,
  `materi_filename` varchar(1001) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_pengumuman`
--

CREATE TABLE `db_pengumuman` (
  `pengumuman_kode` varchar(30) NOT NULL,
  `pengumuman_text` varchar(2100) NOT NULL,
  `pengumuman_date_created` varchar(151) NOT NULL,
  `pengumuman_date_edited` varchar(151) NOT NULL,
  `pengumuman_owner` varchar(221) NOT NULL,
  `pengumuman_peran` varchar(221) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_quiz`
--

CREATE TABLE `db_quiz` (
  `quiz_kelas` varchar(221) NOT NULL,
  `quiz_created` varchar(221) NOT NULL,
  `quiz_owner` varchar(221) NOT NULL,
  `quiz_judul` varchar(221) NOT NULL,
  `quiz_jenis` varchar(221) NOT NULL,
  `quiz_data` longblob NOT NULL,
  `quiz_filename` varchar(1001) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_tugas`
--

CREATE TABLE `db_tugas` (
  `tugas_id` varchar(221) NOT NULL,
  `tugas_kelas` varchar(221) NOT NULL,
  `tugas_owner` varchar(221) NOT NULL,
  `tugas_judul` varchar(221) NOT NULL,
  `tugas_deskripsi` varchar(2100) NOT NULL,
  `tugas_created` varchar(221) NOT NULL,
  `tugas_deadline` varchar(221) NOT NULL,
  `tugas_data` longblob NOT NULL,
  `tugas_filename` varchar(221) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_tugas_siswa`
--

CREATE TABLE `db_tugas_siswa` (
  `tugas_id` varchar(221) NOT NULL,
  `tugas_kelas` varchar(221) NOT NULL,
  `tugas_owner` varchar(221) NOT NULL,
  `tugas_created` varchar(221) NOT NULL,
  `tugas_data` longblob NOT NULL,
  `tugas_filename` varchar(1001) NOT NULL,
  `tugas_status` varchar(221) NOT NULL,
  `tugas_nilai` varchar(221) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `db_users`
--

CREATE TABLE `db_users` (
  `users_profile` varchar(221) NOT NULL,
  `users_nama` varchar(221) NOT NULL,
  `users_email` varchar(221) NOT NULL,
  `users_password` varchar(221) NOT NULL,
  `users_peran` varchar(221) NOT NULL,
  `users_jenjang` varchar(221) NOT NULL,
  `users_instansi` varchar(221) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `db_pengumuman`
--
ALTER TABLE `db_pengumuman`
  ADD PRIMARY KEY (`pengumuman_date_created`);

--
-- Indeks untuk tabel `db_tugas`
--
ALTER TABLE `db_tugas`
  ADD PRIMARY KEY (`tugas_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
