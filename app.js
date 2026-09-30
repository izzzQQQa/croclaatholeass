/* ============ PENGATURAN ============
   Tempel URL Web App dari Apps Script di sini
   (Deploy > New deployment > Web app > salin URL yang berakhiran /exec) */
const API_URL = "https://script.google.com/macros/s/AKfycbzrh8lsiCDDA6mqIyAC7YNNjOJXs23UYevDTz-vbW2cWKs-VEj839BY3riBm60haFvn/exec";

/* Opsional: nomor WhatsApp admin (format 62812xxxx). Kosongkan jika tidak dipakai. */
const WA_ADMIN = "087712030178";
/* ==================================== */

const DEMO = [
  { id: "P1", nama: "Wafer Classic", harga: 12000, deskripsi: "Wafer renyah berlapis cokelat susu lembut.", gambar: "", stok: 50 },
  { id: "P2", nama: "Dark Crunch", harga: 15000, deskripsi: "Cokelat hitam pekat dengan wafer garing.", gambar: "", stok: 30 },
  { id: "P3", nama: "Hazelnut Bliss", harga: 18000, deskripsi: "Krim hazelnut di antara lapisan wafer tipis.", gambar: "", stok: 20 }
];

const $ = (s) => document.querySelector(s);
const rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let products = [];
const cart = {}; // id -> qty

/* ---------- Animasi muncul saat scroll ---------- */
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const t = e.target;
          t.classList.add("in"); io.unobserve(t);
          setTimeout(() => t.style.removeProperty("--d"), 1600);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" })
  : null;

function observe(root = document) {
  root.querySelectorAll(".reveal:not(.in)").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
}

/* Navbar berubah saat di-scroll */
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("solid", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- Produk ---------- */
async function loadProducts() {
  if (!API_URL) { products = DEMO; return renderProducts(); }
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal memuat");
    products = data.products;
    renderProducts();
  } catch (err) {
    console.error(err);
    $("#products").innerHTML = '<p class="msg">Produk belum bisa dimuat. Periksa URL Web App dan coba muat ulang halaman.</p>';
  }
}

function renderProducts() {
  const box = $("#products");
  if (!products.length) { box.innerHTML = '<p class="msg">Belum ada produk. Isi sheet "Produk" untuk mulai berjualan.</p>'; return; }
  box.innerHTML = products.map((p, i) => {
    const habis = Number(p.stok) <= 0;
    const img = p.gambar ? `<img src="${esc(p.gambar)}" alt="${esc(p.nama)}" loading="lazy">` : '<svg class="mini" viewBox="0 0 360 120" aria-hidden="true"><use href="#bar"/></svg>';
    return `<article class="card reveal" style="--d:${(i % 4) * 0.1}s">
      <div class="pimg">${img}</div>
      <div class="cbody"><h3>${esc(p.nama)}</h3><p>${esc(p.deskripsi)}</p>
        <div class="row"><span class="price">${rp(p.harga)}</span>
        <button class="add" data-id="${esc(p.id)}" ${habis ? "disabled" : ""}>${habis ? "Habis" : "Tambah"}</button></div>
      </div></article>`;
  }).join("");
  observe(box);
}

$("#products").addEventListener("click", (e) => {
  const b = e.target.closest(".add");
  if (!b) return;
  const p = products.find((x) => String(x.id) === b.dataset.id);
  if (!p) return;
  if ((cart[p.id] || 0) >= Number(p.stok)) return note("Stok " + p.nama + " tidak cukup.", "err");
  cart[p.id] = (cart[p.id] || 0) + 1;
  note("");
  renderCart();
  b.textContent = "Ditambahkan";
  setTimeout(() => (b.textContent = "Tambah"), 900);
});

/* ---------- Keranjang ---------- */
function renderCart() {
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);
  let total = 0, count = 0;
  $("#cart").innerHTML = ids.length ? ids.map((id) => {
    const p = products.find((x) => String(x.id) === id);
    const sub = p.harga * cart[id]; total += sub; count += cart[id];
    return `<div class="item"><div><strong>${esc(p.nama)}</strong><br><small>${rp(sub)}</small></div>
      <div class="qty"><button data-a="-" data-id="${esc(id)}" aria-label="Kurangi">−</button><span>${cart[id]}</span><button data-a="+" data-id="${esc(id)}" aria-label="Tambah">+</button></div></div>`;
  }).join("") : '<p style="color:#b9a892">Keranjang masih kosong. Pilih cokelat di atas.</p>';
  $("#total").textContent = rp(total);
  $("#count").textContent = count;
}

$("#cart").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  const id = b.dataset.id, p = products.find((x) => String(x.id) === id);
  if (b.dataset.a === "+") { if (cart[id] < Number(p.stok)) cart[id]++; else note("Stok tidak cukup.", "err"); }
  else { cart[id]--; if (cart[id] <= 0) delete cart[id]; }
  renderCart();
});

$("#goCart").addEventListener("click", () => $("#pesan").scrollIntoView({ behavior: "smooth" }));

/* ---------- Kirim pesanan ---------- */
function note(msg, type) { const n = $("#note"); n.textContent = msg; n.className = "note " + (type || ""); }

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const items = Object.keys(cart).map((id) => ({ id, qty: cart[id] }));
  if (!items.length) return note("Tambahkan minimal satu produk ke keranjang.", "err");
  const v = (n) => f.elements[n].value.trim();
  const nama = v("nama"), wa = v("wa"), alamat = v("alamat");
  if (!nama || !alamat) return note("Nama dan alamat wajib diisi.", "err");
  if (!/^(\+?62|0)8\d{7,12}$/.test(wa.replace(/[\s-]/g, ""))) return note("Nomor WhatsApp tidak valid. Contoh: 08123456789.", "err");

  if (!API_URL) return note("Mode demo: isi API_URL di app.js agar pesanan tersimpan ke spreadsheet.", "err");

  const btn = $("#send");
  btn.disabled = true; btn.textContent = "Mengirim...";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ nama, wa, alamat, catatan: v("catatan"), items })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal mengirim");
    note("Pesanan terkirim. Nomor pesanan: " + data.orderId + ". Kami akan menghubungi lewat WhatsApp.", "ok");
    if (WA_ADMIN) {
      const text = `Halo, saya ${nama}. Pesanan ${data.orderId} total ${rp(data.total)}.`;
      window.open(`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }
    Object.keys(cart).forEach((k) => delete cart[k]);
    f.reset(); renderCart(); loadProducts();
  } catch (err) {
    note(err.message || "Pesanan gagal dikirim. Coba lagi.", "err");
  } finally {
    btn.disabled = false; btn.textContent = "Kirim pesanan";
  }
});

/* ---------- Mulai ---------- */
observe();
renderCart();
loadProducts();
