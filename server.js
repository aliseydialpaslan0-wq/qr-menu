const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
    next();
});
app.use(express.static('public'));

var sonBildirimler = [];

// Menü
const MENU_DOSYA = path.join(__dirname, 'menu.json');
function menuOku() {
    if (!fs.existsSync(MENU_DOSYA)) {
        const varsayilan = {
            "🍕 Pizzalar": [
                { ad: "Karışık Pizza", aciklama: "Sucuk, mantar, biber, zeytin", fiyat: "180 ₺" },
                { ad: "Margarita", aciklama: "Domates sosu, mozzarella, fesleğen", fiyat: "150 ₺" }
            ],
            "🥤 İçecekler": [
                { ad: "Kola", aciklama: "330 ml kutu", fiyat: "50 ₺" },
                { ad: "Ayran", aciklama: "Ev yapımı", fiyat: "40 ₺" }
            ]
        };
        fs.writeFileSync(MENU_DOSYA, JSON.stringify(varsayilan, null, 2), 'utf8');
    }
    return JSON.parse(fs.readFileSync(MENU_DOSYA, 'utf8'));
}
function menuKaydet(menu) {
    fs.writeFileSync(MENU_DOSYA, JSON.stringify(menu, null, 2), 'utf8');
}

// İstatistik
const ISTAT_DOSYA = path.join(__dirname, 'istatistik.json');
function istatOku() {
    if (!fs.existsSync(ISTAT_DOSYA)) {
        fs.writeFileSync(ISTAT_DOSYA, JSON.stringify({}), 'utf8');
    }
    return JSON.parse(fs.readFileSync(ISTAT_DOSYA, 'utf8'));
}
function istatKaydet(data) {
    fs.writeFileSync(ISTAT_DOSYA, JSON.stringify(data, null, 2), 'utf8');
}
function istatEkle(mesaj, toplam) {
    const bugun = new Date().toLocaleDateString('tr-TR');
    const saat = new Date().getHours();
    const data = istatOku();
    if (!data[bugun]) data[bugun] = { garson: 0, nakit: 0, kart: 0, nakitToplam: 0, kartToplam: 0, saatlik: {}, anketler: [] };
    if (!data[bugun].saatlik[saat]) data[bugun].saatlik[saat] = 0;
    if (mesaj.includes('Garson')) { data[bugun].garson++; }
    else if (mesaj.includes('Nakit')) { data[bugun].nakit++; data[bugun].nakitToplam += toplam || 0; }
    else if (mesaj.includes('Kart')) { data[bugun].kart++; data[bugun].kartToplam += toplam || 0; }
    data[bugun].saatlik[saat]++;
    istatKaydet(data);
}

// Anket
function anketEkle(puan, masa) {
    const bugun = new Date().toLocaleDateString('tr-TR');
    const data = istatOku();
    if (!data[bugun]) data[bugun] = { garson: 0, nakit: 0, kart: 0, nakitToplam: 0, kartToplam: 0, saatlik: {}, anketler: [] };
    if (!data[bugun].anketler) data[bugun].anketler = [];
    data[bugun].anketler.push({ puan: puan, masa: masa, saat: new Date().toLocaleTimeString('tr-TR') });
    istatKaydet(data);
}

// API
app.get('/api/menu', (req, res) => res.json(menuOku()));
app.post('/api/menu', (req, res) => {
    menuKaydet(req.body);
    io.emit('menu-guncellendi', req.body);
    res.json({ ok: true });
});
app.get('/api/istatistik', (req, res) => res.json(istatOku()));
app.get('/api/son-bildirimler', (req, res) => res.json(sonBildirimler));
app.post('/api/anket', (req, res) => {
    anketEkle(req.body.puan, req.body.masa);
    res.json({ ok: true });
});

// Socket
io.on('connection', (socket) => {
    socket.on('masa-bildirimi', (data) => {
        const saat = new Date().toLocaleTimeString('tr-TR');
        const bildirim = {
            masa: data.masa,
            mesaj: data.mesaj,
            sepet: data.sepet || [],
            toplam: data.toplam || 0,
            saat: saat
        };
        sonBildirimler.unshift(bildirim);
        if (sonBildirimler.length > 20) sonBildirimler.pop();
        istatEkle(data.mesaj, data.toplam);
        io.emit('yeni-bildirim', bildirim);
    });
});

server.listen(3000, () => {
    console.log('Sunucu çalışıyor: http://localhost:3000');
});