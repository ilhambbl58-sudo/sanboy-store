// @ts-nocheck
import {
    auth,
    db,
    signOut,
    onAuthStateChanged
} from "./firebase.js";

import {
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp,
    doc,
    runTransaction,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let currentUser = null;
let transaksi = [];
let utang = [];
let piutang = [];

const formatRupiah = (angka) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(angka);

function tampilkanSaldo() {
    let pemasukanCash = 0;
    let pengeluaranCash = 0;
    let pemasukanDana = 0;
    let pengeluaranDana = 0;

    transaksi.forEach(data => {
        const jumlah = Number(data.jumlah) || 0;

        if (data.metode === "cash") {
            if (data.jenis === "pemasukan") {
                pemasukanCash += jumlah;
            } else {
                pengeluaranCash += jumlah;
            }
        }

        if (data.metode === "dana") {
            if (data.jenis === "pemasukan") {
                pemasukanDana += jumlah;
            } else {
                pengeluaranDana += jumlah;
            }
        }
    });

    const saldoCash = pemasukanCash - pengeluaranCash;
    const saldoDana = pemasukanDana - pengeluaranDana;

    document.getElementById("pemasukanCash").textContent =
        formatRupiah(pemasukanCash);

    document.getElementById("pengeluaranCash").textContent =
        formatRupiah(pengeluaranCash);

    document.getElementById("pemasukanDana").textContent =
        formatRupiah(pemasukanDana);

    document.getElementById("pengeluaranDana").textContent =
        formatRupiah(pengeluaranDana);

    document.getElementById("saldoCash").textContent =
        formatRupiah(saldoCash);

    document.getElementById("saldoDana").textContent =
        formatRupiah(saldoDana);

    document.getElementById("totalSaldo").textContent =
        formatRupiah(saldoCash + saldoDana);

    const totalUtang = utang
        .filter(d => d.status !== "lunas")
        .reduce((total, d) => total + Number(d.sisa), 0);

    const totalPiutang = piutang
        .filter(d => d.status !== "lunas")
        .reduce((total, d) => total + Number(d.sisa), 0);

    document.getElementById("totalUtang").textContent =
        formatRupiah(totalUtang);

    document.getElementById("totalPiutang").textContent =
        formatRupiah(totalPiutang);

    tampilkanRiwayat();
    tampilkanUtang();
    tampilkanPiutang();
    tampilkanRiwayatPembayaran();
}

function tampilkanRiwayat() {
    const tempat = document.getElementById("daftarRiwayat");

    const data = [...transaksi].sort(
        (a, b) => (b.waktu || 0) - (a.waktu || 0)
    );

    tempat.innerHTML = "";

    if (data.length === 0) {
        tempat.textContent = "Belum ada transaksi.";
        return;
    }

    data.forEach(item => {
        const baris = document.createElement("div");
        baris.style.padding = "12px";
        baris.style.borderBottom = "1px solid #345579";

        const judul = document.createElement("strong");

        judul.textContent =
            (item.jenis === "pemasukan" ? "+ " : "- ") +
            formatRupiah(item.jumlah);

        const keterangan = document.createElement("p");

        keterangan.textContent =
            (item.keterangan || "Tanpa keterangan") +
            " • " +
            String(item.metode || "cash").toUpperCase();

        keterangan.style.color = "#a9c4e4";
        keterangan.style.marginTop = "5px";

        const tanggal = document.createElement("small");

        tanggal.textContent = item.waktu
            ? new Date(item.waktu).toLocaleString("id-ID")
            : "Waktu tidak tersedia";

        tanggal.style.color = "#829bb8";

      // TOMBOL EDIT
const tombolEdit = document.createElement("button");

tombolEdit.textContent = "✏️ EDIT";
tombolEdit.type = "button";
tombolEdit.style.marginTop = "10px";
tombolEdit.style.background = "#0878e8";
tombolEdit.style.color = "white";
tombolEdit.style.border = "none";
tombolEdit.style.padding = "10px";
tombolEdit.style.borderRadius = "8px";

tombolEdit.onclick = () => editTransaksi(item);

        const tombolHapus = document.createElement("button");

tombolHapus.textContent = "🗑️ HAPUS";
tombolHapus.type = "button";
tombolHapus.style.marginTop = "10px";
tombolHapus.style.marginLeft = "8px";
tombolHapus.style.background = "#c0392b";
tombolHapus.style.color = "white";
tombolHapus.style.border = "none";
tombolHapus.style.padding = "10px";
tombolHapus.style.borderRadius = "8px";

tombolHapus.onclick = () => hapusTransaksi(item);
        baris.append(
    judul,
    keterangan,
    tanggal,
    tombolEdit,
    tombolHapus
);

        tempat.appendChild(baris);
    });
}


// PROSES PEMBAYARAN UTANG DAN PIUTANG
 // DATA PEMBAYARAN YANG SEDANG DIPROSES
let pembayaranAktif = null;

// BUKA MODAL PEMBAYARAN
function prosesPembayaran(koleksi, item, jenisTransaksi, judul) {
    pembayaranAktif = {
        koleksi,
        item,
        jenisTransaksi,
        judul
    };

    document.getElementById("judulPembayaran").textContent = judul;
    document.getElementById("namaTagihan").textContent =
        "Nama: " + item.nama;

    document.getElementById("sisaTagihan").textContent =
        formatRupiah(item.sisa);

    document.getElementById("jumlahPembayaran").value = "";
    document.getElementById("jumlahPembayaran").max = item.sisa;
    document.getElementById("metodePembayaran").value =
        item.metode || "cash";

    document.getElementById("modalPembayaran").style.display = "flex";
}

// TUTUP MODAL
function tutupModalPembayaran() {
    document.getElementById("modalPembayaran").style.display = "none";
    document.getElementById("formPembayaran").reset();
    pembayaranAktif = null;
}

// TOMBOL TUTUP DAN BATAL
document.getElementById("tutupModal").onclick =
    tutupModalPembayaran;

document.getElementById("batalPembayaran").onclick =
    tutupModalPembayaran;


// PROSES KONFIRMASI PEMBAYARAN
document.getElementById("formPembayaran").addEventListener(
    "submit",
    async function(e) {
        e.preventDefault();

        if (!pembayaranAktif || !currentUser) return;

        const jumlah = Number(
            document.getElementById("jumlahPembayaran").value
        );

        const metode =
            document.getElementById("metodePembayaran").value;

        const {
            koleksi,
            item,
            jenisTransaksi,
            judul
        } = pembayaranAktif;

        if (!Number.isSafeInteger(jumlah) || jumlah <= 0) {
            alert("Jumlah pembayaran tidak valid.");
            return;
        }

        if (metode !== "cash" && metode !== "dana") {
            alert("Metode pembayaran tidak valid.");
            return;
        }

        if (jumlah > Number(item.sisa)) {
            alert("Pembayaran melebihi sisa tagihan.");
            return;
        }

        const uid = currentUser.uid;

        const tagihanRef = doc(
            db, "users", uid, koleksi, item.id
        );

        const transaksiRef = doc(
            collection(db, "users", uid, "transactions")
        );

        const tombol = document.querySelector(
            "#formPembayaran button[type='submit']"
        );

        tombol.disabled = true;
        tombol.textContent = "MEMPROSES...";

        try {
            await runTransaction(db, async transaksiFirebase => {
                const hasil = await transaksiFirebase.get(tagihanRef);

                if (!hasil.exists()) {
                    throw new Error("Data tidak ditemukan.");
                }

                const data = hasil.data();
                const sisa = Number(data.sisa);

                if (!Number.isSafeInteger(sisa) || sisa <= 0) {
                    throw new Error("Tagihan sudah lunas.");
                }

                if (jumlah > sisa) {
                    throw new Error("Pembayaran melebihi sisa tagihan.");
                }

                const sisaBaru = sisa - jumlah;

                transaksiFirebase.update(tagihanRef, {
                    sisa: sisaBaru,
                    status: sisaBaru === 0 ? "lunas" : "belum_lunas",
                    diperbarui: serverTimestamp()
                });

                transaksiFirebase.set(transaksiRef, {
                    jenis: jenisTransaksi,
                    metode,
                    jumlah,
                    keterangan: judul + " - " + data.nama,
                    waktu: Date.now(),
                    dibuat: serverTimestamp()
                });
            });

            tutupModalPembayaran();
            alert("Pembayaran berhasil dicatat!");

        } catch (error) {
            alert("Gagal memproses pembayaran: " + error.message);

        } finally {
            tombol.disabled = false;
            tombol.textContent = "KONFIRMASI";
        }
    }
);

// TAMPILKAN DAFTAR UTANG
function tampilkanUtang() {
    const tempat = document.getElementById("daftarUtang");
    tempat.innerHTML = "";

    const aktif = utang.filter(d => d.status !== "lunas");

    if (aktif.length === 0) {
        tempat.textContent = "Belum ada utang.";
        return;
    }

    aktif.forEach(item => {
        const div = document.createElement("div");
        div.className = "tagihan-card";

        const nama = document.createElement("strong");
        nama.textContent = "👤 " + item.nama;

        const sisa = document.createElement("p");
        sisa.textContent = "Sisa Utang: " + formatRupiah(item.sisa);

        const metode = document.createElement("small");
        metode.textContent = String(item.metode || "cash").toUpperCase();

        const tombol = document.createElement("button");
        tombol.textContent = "BAYAR UTANG";
        tombol.type = "button";
        tombol.onclick = () => prosesPembayaran(
            "debts", item, "pengeluaran", "Pembayaran utang"
        );

        div.append(nama, sisa, metode, tombol);
        tempat.appendChild(div);
    });
}

// TAMPILKAN DAFTAR PIUTANG
function tampilkanPiutang() {
    const tempat = document.getElementById("daftarPiutang");
    tempat.innerHTML = "";

    const aktif = piutang.filter(d => d.status !== "lunas");

    if (aktif.length === 0) {
        tempat.textContent = "Belum ada piutang.";
        return;
    }

    aktif.forEach(item => {
        const div = document.createElement("div");
        div.className = "tagihan-card";

        const nama = document.createElement("strong");
        nama.textContent = "👤 " + item.nama;

        const sisa = document.createElement("p");
        sisa.textContent = "Sisa Piutang: " + formatRupiah(item.sisa);

        const metode = document.createElement("small");
        metode.textContent = String(item.metode || "cash").toUpperCase();

        const tombol = document.createElement("button");
        tombol.textContent = "TERIMA PEMBAYARAN";
        tombol.type = "button";
        tombol.onclick = () => prosesPembayaran(
            "receivables", item, "pemasukan", "Pembayaran piutang"
        );

        div.append(nama, sisa, metode, tombol);
        tempat.appendChild(div);
    });
}

// TAMBAH TRANSAKSI
document.getElementById("transaksiForm")
.addEventListener("submit", async e => {
    e.preventDefault();

    if (!currentUser) return;

    const jenis = document.getElementById("jenisTransaksi").value;
    const metode = document.getElementById("metode").value;
    const jumlah = Number(document.getElementById("jumlah").value);
    const keterangan = document.getElementById("keterangan").value.trim();

    if (!Number.isSafeInteger(jumlah) || jumlah <= 0 || !keterangan) {
        alert("Periksa jumlah dan keterangan transaksi.");
        return;
    }

    try {
        await addDoc(
            collection(db, "users", currentUser.uid, "transactions"),
            {
                jenis,
                metode,
                jumlah,
                keterangan,
                waktu: Date.now(),
                dibuat: serverTimestamp()
            }
        );

        e.target.reset();
        alert("Transaksi berhasil disimpan!");

    } catch (error) {
        alert("Gagal menyimpan: " + error.message);
    }
});

// TAMBAH UTANG
document.getElementById("utangForm")
.addEventListener("submit", async e => {
    e.preventDefault();

    if (!currentUser) return;

    const nama = document.getElementById("namaUtang").value.trim();
    const jumlah = Number(document.getElementById("jumlahUtang").value);
    const metode = document.getElementById("metodeUtang").value;
    const keterangan = document.getElementById("ketUtang").value.trim();

    if (!nama || !Number.isSafeInteger(jumlah) || jumlah <= 0) {
        alert("Periksa data utang.");
        return;
    }

    try {
        const uid = currentUser.uid;

        await addDoc(collection(db, "users", uid, "transactions"), {
            jenis: "pemasukan",
            metode,
            jumlah,
            keterangan: "Pinjaman dari " + nama,
            waktu: Date.now(),
            dibuat: serverTimestamp()
        });

        await addDoc(collection(db, "users", uid, "debts"), {
            nama,
            jumlah,
            sisa: jumlah,
            metode,
            keterangan,
            status: "belum_lunas",
            dibuat: serverTimestamp()
        });

        e.target.reset();
        alert("Utang berhasil dicatat!");

    } catch (error) {
        alert("Gagal menyimpan utang: " + error.message);
    }
});

// TAMBAH PIUTANG
document.getElementById("piutangForm")
.addEventListener("submit", async e => {
    e.preventDefault();

    if (!currentUser) return;

    const nama = document.getElementById("namaPiutang").value.trim();
    const jumlah = Number(document.getElementById("jumlahPiutang").value);
    const metode = document.getElementById("metodePiutang").value;
    const keterangan = document.getElementById("ketPiutang").value.trim();

    if (!nama || !Number.isSafeInteger(jumlah) || jumlah <= 0) {
        alert("Periksa data piutang.");
        return;
    }

    try {
        const uid = currentUser.uid;

        await addDoc(collection(db, "users", uid, "transactions"), {
            jenis: "pengeluaran",
            metode,
            jumlah,
            keterangan: "Dipinjamkan kepada " + nama,
            waktu: Date.now(),
            dibuat: serverTimestamp()
        });

        await addDoc(collection(db, "users", uid, "receivables"), {
            nama,
            jumlah,
            sisa: jumlah,
            metode,
            keterangan,
            status: "belum_lunas",
            dibuat: serverTimestamp()
        });

        e.target.reset();
        alert("Piutang berhasil dicatat!");

    } catch (error) {
        alert("Gagal menyimpan piutang: " + error.message);
    }
});

// MENU SAMPING
document.getElementById("menuBtn").onclick = () => {
    document.getElementById("sideMenu").classList.add("active");
};

document.getElementById("closeMenu").onclick = () => {
    document.getElementById("sideMenu").classList.remove("active");
};

// LOGOUT
document.getElementById("logoutBtn").onclick = async () => {
    try {
        await signOut(auth);
        window.location.replace("halamanlogin.html");
    } catch (error) {
        alert(error.message);
    }
};

// CEK LOGIN
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;

        document.getElementById("namaUser").textContent =
            user.displayName || "Pengguna";

        document.getElementById("emailUser").textContent =
            user.email || "Email tidak tersedia";

        muatData(user.uid);
    } else {
        window.location.replace("halamanlogin.html");
    }
});

// MEMUAT DATA FIREBASE
function muatData(uid) {
    const dasar = ["users", uid];

    onSnapshot(
        collection(db, ...dasar, "transactions"),
        snapshot => {
            transaksi = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
}));
            tampilkanSaldo();
        },
        error => {
            console.error("Gagal memuat transaksi:", error);
            alert("Gagal memuat transaksi: " + error.message);
        }
    );

    onSnapshot(
        collection(db, ...dasar, "debts"),
        snapshot => {
            utang = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
}));
            tampilkanSaldo();
        }
    );

    onSnapshot(
        collection(db, ...dasar, "receivables"),
        snapshot => {
            piutang = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
}));
            tampilkanSaldo();
        }
    );
}

// TAMPILKAN RIWAYAT PEMBAYARAN
function tampilkanRiwayatPembayaran() {
    const tempat = document.getElementById("riwayatPembayaran");
    tempat.innerHTML = "";

    const data = transaksi
        .filter(item =>
            item.keterangan &&
            (
                item.keterangan.includes("Pembayaran utang") ||
                item.keterangan.includes("Pembayaran piutang")
            )
        )
        .sort((a, b) => b.waktu - a.waktu);

    if (data.length === 0) {
        tempat.textContent = "Belum ada riwayat pembayaran.";
        return;
    }

    data.forEach(item => {
        const kartu = document.createElement("div");
        kartu.className = "riwayat-card";

        const judul = document.createElement("div");
        judul.className = "riwayat-judul";

        const nama = document.createElement("span");
        nama.textContent = item.keterangan;

        const badge = document.createElement("span");
        badge.className = "riwayat-badge";
        badge.textContent =
            item.jenis === "pengeluaran" ? "BAYAR UTANG" : "PIUTANG";

        judul.append(nama, badge);

        const nominal = document.createElement("div");
        nominal.className = "riwayat-nominal";
        nominal.textContent = formatRupiah(item.jumlah);

        const metode = document.createElement("small");
        metode.textContent =
            "Metode: " + String(item.metode).toUpperCase();

        const tanggal = document.createElement("small");
        tanggal.textContent =
            "Tanggal: " +
            new Date(item.waktu).toLocaleString("id-ID");

        kartu.append(judul, nominal, metode, tanggal);
        tempat.appendChild(kartu);
    });
}

// EDIT TRANSAKSI
async function editTransaksi(item) {
    if (!currentUser || !item.id) {
        alert("ID transaksi tidak ditemukan.");
        return;
    }

    const jumlahBaru = prompt(
        "Masukkan nominal baru:",
        item.jumlah
    );

    if (jumlahBaru === null) return;

    const jumlah = Number(jumlahBaru);

    if (!Number.isSafeInteger(jumlah) || jumlah <= 0) {
        alert("Nominal tidak valid.");
        return;
    }

    const keteranganBaru = prompt(
        "Masukkan keterangan baru:",
        item.keterangan || ""
    );

    if (keteranganBaru === null) return;

    const metodeBaru = prompt(
        "Metode pembayaran: cash atau dana",
        item.metode || "cash"
    );

    if (metodeBaru === null) return;

    const metode = metodeBaru.trim().toLowerCase();

    if (metode !== "cash" && metode !== "dana") {
        alert("Metode harus cash atau dana.");
        return;
    }

    try {
        const transaksiRef = doc(
            db,
            "users",
            currentUser.uid,
            "transactions",
            item.id
        );

        await updateDoc(transaksiRef, {
            jumlah: jumlah,
            keterangan: keteranganBaru,
            metode: metode
        });

        alert("Transaksi berhasil diperbarui!");

    } catch (error) {
        alert("Gagal mengedit transaksi: " + error.message);
    }
}

// HAPUS TRANSAKSI
async function hapusTransaksi(item) {
    if (!currentUser || !item.id) {
        alert("Data transaksi tidak ditemukan.");
        return;
    }

    const keterangan = item.keterangan || "";

    // LINDUNGI TRANSAKSI UTANG DAN PIUTANG
    const transaksiTerhubung =
        keterangan.startsWith("Pinjaman dari ") ||
        keterangan.startsWith("Dipinjamkan kepada ") ||
        keterangan.startsWith("Pembayaran utang") ||
        keterangan.startsWith("Pembayaran piutang");

    if (transaksiTerhubung) {
        alert(
            "Transaksi ini terhubung dengan data utang/piutang. " +
            "Penghapusan melalui fitur ini tidak diizinkan."
        );
        return;
    }

    const yakin = confirm(
        "Apakah kamu yakin ingin menghapus transaksi ini?\n\n" +
        "Nominal: " + formatRupiah(item.jumlah) +
        "\nKeterangan: " + keterangan
    );

    if (!yakin) return;

    try {
        const transaksiRef = doc(
            db,
            "users",
            currentUser.uid,
            "transactions",
            item.id
        );

        await deleteDoc(transaksiRef);

        alert("Transaksi berhasil dihapus!");

        // Saldo dan riwayat diperbarui otomatis oleh onSnapshot.

    } catch (error) {
        alert("Gagal menghapus transaksi: " + error.message);
    }
}