
const text = `
ÖRNEK ÖĞRENCİ

Öğr. No: 999999999

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
    NotDurumu

Not Durumu
Genel Akademik Ortalama: 2,87
2024-2025 Güz Dönemi
	
Dönem Ortalaması: 3,03
Ders Kodu 	Yıl 	Ders Adı 	ECTS 	Sınavlar 	Genel Ortalama 	Harf 	Durum
1202104 	2025 	Matematik I 	6 	Vize 60
Final 75
	69 	BB 	Başarılı
1202105 	2025 	Fizik I 	6 	Vize 50
Final 60
	56 	CC 	Başarılı
1202106 	2025 	Kimya 	5 	Vize 70
Final 70
	70 	BB 	Başarılı
1202121 	2025 	Yabancı Dil I 	3 	Vize 60
Final 80
	72 	BB 	Başarılı
1202131 	2025 	Türk Dili ve Edebiyatı 	4 	Vize 85
Final 90
	88 	AA 	Başarılı
1202132 	2025 	Elektrik-Elektronik Mühendisliğine Giriş 	6 	Vize 65
Final 85
	77 	BA 	Başarılı
2024-2025 Bahar Dönemi
	
Dönem Ortalaması: 2,7
Ders Kodu 	Yıl 	Ders Adı 	ECTS 	Sınavlar 	Genel Ortalama 	Harf 	Durum
1202205 	2025 	Matematik II 	6 	Vize 70
Final 70
	70 	BB 	Başarılı
1202206 	2025 	Fizik II 	6 	Vize 50
Final 60
	56 	CC 	Başarılı
1202221 	2025 	Yabancı Dil II 	3 	Vize 50
Final 60
	56 	CC 	Başarılı
1202222 	2025 	Atatürk İlkeleri ve İnkılap Tarihi 	4 	Vize 90
Final 90
	90 	AA 	Başarılı
1202223 	2025 	Bilgisayar Destekli Teknik Resim 	2 	Vize 80
Final 90
	86 	AA 	Başarılı
1202224 	2025 	Lineer Cebir 	3 	Vize 85
Final 85
	85 	AA 	Başarılı
1202225 	2025 	Bilgisayar Programlama I 	6 	Vize 40
Final 50
	46 	DC 	Başarılı
2025-2026 Güz Dönemi
	
Dönem Ortalaması: 0
Ders Kodu 	Yıl 	Ders Adı 	ECTS 	Sınavlar 	Genel Ortalama 	Harf 	Durum
1202301 	2026 	Devre Analizi I 	5 	Vize 50
	-1 	- 	Yeni
1202303 	2026 	Diferansiyel Denklemler 	4 	Vize 80
	-1 	- 	Yeni
1202304 	2026 	Elektronik I 	5 	Vize 60
	-1 	- 	Yeni
1202307 	2026 	Mühendislik Mekaniği 	4 	Vize 90
	-1 	- 	Yeni
1202311 	2026 	Temel Elektrik ve Ölçme Lab. 	2 	Vize 75
	-1 	- 	Yeni
1202312 	2026 	Lojik Devreler 	5 	Vize 65
	-1 	- 	Yeni
1202313 	2026 	Bilgisayar Programlama II 	3 	Vize 70
	-1 	- 	Yeni
1202314 	2026 	İş Sağlığı ve Güvenliği I 	2 	Vize 55
	-1 	- 	Yeni
©2021 Bilgi İşlem Daire Başkanlığı
Hakkımızda Yardım İletişim
`;

const normalized = text.replace(/\s+/g, ' ');
// Fix: Use \b to avoid matching 7 digits inside a 9-digit Student ID
const regex = /\b(\d{7})\b.*?(20\d\d)\s+(.+?)\s+(\d{1,2})\s+(.*?)(?=\b\d{7}\b|$)/g;

let match;
let count = 0;
while ((match = regex.exec(normalized)) !== null) {
    const courseCode = match[1];
    const courseName = match[3].trim();
    const courseCredit = match[4];

    // Logic from v16
    if (courseName.includes("Dönem") || courseName.includes("Ortalama") || courseName.includes("Genel")) {
        console.log("IGNORED: " + courseName);
        continue;
    }

    console.log(`PARSED: [${courseCode}] Y:${match[2]} Name:${courseName} Cr:${courseCredit}`);
    count++;
}
console.log("Total Clean Courses: " + count);
