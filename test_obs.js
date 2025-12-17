
const text = `
HALİL BOZOĞLU

Öğr. No: 241202032

    Genel Menü
    İlişik Kesme
    Yatay Geçiş Başvuru
    Öğrenci
    Anasayfa
    Kişisel Bilgiler
    Aktif Dönem Notlarım
    Harç Durumu
    Not Durumu
    Transkript
    Mesaj Kutusu
    Bilgilendirme

    Ogrenci
    SonYilNotlari

Aktif Dönem Notları
2025-2026 Güz Dönemi
	
Dönem Ortalaması: 0
	Ders Kodu 	Şube No 	Yıl 	Ders Adı 	ECTS 	Sınavlar 	Genel Ortalama 	Harf 	Durum
	1202301 	0 	2026 	Devre Analizi I 	5 	Vize 44
`;

const normalized = text.replace(/\s+/g, ' ');
const regex = /(\d{7}).*?(20\d\d)\s+(.+?)\s+(\d{1,2})\s+(.*?)(?=\d{7}|$)/g;

let match;
console.log("Normalized: " + normalized.substring(0, 500));

while ((match = regex.exec(normalized)) !== null) {
    console.log("MATCH FOUND:");
    console.log("Code: " + match[1]);
    console.log("Year: " + match[2]);
    console.log("Name: " + match[3]);
    console.log("Credit: " + match[4]);
}
