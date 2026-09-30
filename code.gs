/**
 * Kakao Moment — backend Google Sheets
 * Cara pakai:
 * 1. Buka spreadsheet > Ekstensi > Apps Script, tempel kode ini.
 * 2. Jalankan fungsi setup() sekali (izinkan akses). Sheet "Produk" dan "Pesanan" dibuat otomatis.
 * 3. Deploy > New deployment > Web app
 *    Execute as: Me | Who has access: Anyone > Deploy > salin URL /exec ke app.js
 * Setiap mengubah kode, deploy ulang (Manage deployments > Edit > New version).
 */

const SHEET_PRODUK = "Produk";
const SHEET_PESANAN = "Pesanan";

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let p = ss.getSheetByName(SHEET_PRODUK);
  if (!p) {
    p = ss.insertSheet(SHEET_PRODUK);
    p.appendRow(["ID", "Nama", "Harga", "Deskripsi", "Gambar", "Stok", "Aktif"]);
    p.appendRow(["P1", "Wafer Classic", 12000, "Wafer renyah berlapis cokelat susu lembut.", "", 50, "YA"]);
    p.appendRow(["P2", "Dark Crunch", 15000, "Cokelat hitam pekat dengan wafer garing.", "", 30, "YA"]);
    p.appendRow(["P3", "Hazelnut Bliss", 18000, "Krim hazelnut di antara lapisan wafer tipis.", "", 20, "YA"]);
    p.getRange("A1:G1").setFontWeight("bold").setBackground("#e0a93f");
    p.setFrozenRows(1);
  }
  let o = ss.getSheetByName(SHEET_PESANAN);
  if (!o) {
    o = ss.insertSheet(SHEET_PESANAN);
    o.appendRow(["Order ID", "Waktu", "Nama", "WhatsApp", "Alamat", "Catatan", "Pesanan", "Total", "Status"]);
    o.getRange("A1:I1").setFontWeight("bold").setBackground("#e0a93f");
    o.setFrozenRows(1);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readProducts_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRODUK);
  if (!sh) throw new Error('Sheet "Produk" belum ada. Jalankan setup() dulu.');
  const rows = sh.getDataRange().getValues().slice(1);
  return rows
    .map((r, i) => ({ row: i + 2, id: String(r[0]), nama: r[1], harga: Number(r[2]) || 0, deskripsi: r[3], gambar: r[4], stok: Number(r[5]) || 0, aktif: String(r[6]).toUpperCase() }))
    .filter((p) => p.id && p.nama && p.aktif !== "TIDAK");
}

// Menampilkan daftar produk
function doGet() {
  try {
    const products = readProducts_().map(({ row, aktif, ...p }) => p);
    return json_({ ok: true, products });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

// Menerima pesanan
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    const nama = String(d.nama || "").trim().slice(0, 100);
    const wa = String(d.wa || "").trim().slice(0, 20);
    const alamat = String(d.alamat || "").trim().slice(0, 300);
    const catatan = String(d.catatan || "").trim().slice(0, 300);
    if (!nama || !wa || !alamat) throw new Error("Data pengiriman belum lengkap.");
    if (!Array.isArray(d.items) || !d.items.length) throw new Error("Keranjang kosong.");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const produkSheet = ss.getSheetByName(SHEET_PRODUK);
    const products = readProducts_();
    let total = 0;
    const lines = [], updates = [];

    d.items.forEach((it) => {
      const qty = Math.floor(Number(it.qty));
      const p = products.find((x) => x.id === String(it.id));
      if (!p || !(qty > 0)) throw new Error("Produk tidak valid.");
      if (qty > p.stok) throw new Error("Stok " + p.nama + " tinggal " + p.stok + ".");
      total += p.harga * qty; // harga selalu dihitung dari sheet
      lines.push(p.nama + " x" + qty);
      updates.push({ row: p.row, stok: p.stok - qty });
    });

    updates.forEach((u) => produkSheet.getRange(u.row, 6).setValue(u.stok));

    const orderId = "KM-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyMMdd-HHmmss");
    const safe = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v); // cegah formula injection
    ss.getSheetByName(SHEET_PESANAN).appendRow([
      orderId, new Date(), safe(nama), "'" + wa, safe(alamat), safe(catatan), lines.join(", "), total, "Baru"
    ]);
    return json_({ ok: true, orderId: orderId, total: total });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
