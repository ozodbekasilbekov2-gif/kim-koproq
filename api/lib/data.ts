export type Group = 'A' | 'B'
export type Member = { id: string; name: string; short: string; group: Group; photo: boolean }

export const MEMBERS: Member[] = [
  // ---- A guruh ----
  { id: 'mirzayev-nurlibek', name: 'Mirzayev Nurlibek', short: 'Nurlibek', group: 'A', photo: false },
  { id: 'asilbekov-ozodbek', name: 'Asilbekov Ozodbek', short: 'Ozodbek A.', group: 'A', photo: true },
  { id: 'abduqodirova-nargis', name: 'Abduqodirova Nargis', short: 'Nargis', group: 'A', photo: true },
  { id: 'bahriddinova-nodirabegim', name: 'Bahriddinova Nodirabegim', short: 'Nodira', group: 'A', photo: false },
  { id: 'ochilov-ulugbek', name: "Ochilov Ulug'bek", short: "Ulug'bek O.", group: 'A', photo: true },
  { id: 'shokirjonov-muhammad', name: 'Shokirjonov Muhammad', short: 'Muhammad', group: 'A', photo: true },
  { id: 'rustamov-ibrohim', name: 'Rustamov Ibrohim', short: 'Ibrohim', group: 'A', photo: true },
  { id: 'ismadiyorov-doniyorbek', name: 'Ismadiyorov Doniyorbek', short: 'Doniyor', group: 'A', photo: true },
  { id: 'isomiddinov-muhammadyusuf', name: 'Isomiddinov Muhammad Yusuf', short: 'M. Yusuf', group: 'A', photo: true },
  { id: 'erkinov-murodjon', name: 'Erkinov Murodjon', short: 'Murodjon', group: 'A', photo: true },
  { id: 'odilov-mukhammaddiyor', name: 'Odilov Muhammad Diyor', short: 'M. Diyor', group: 'A', photo: true },
  { id: 'tursunboyev-samandar', name: 'Tursunboyev Samandar', short: 'Samandar', group: 'A', photo: true },
  { id: 'barotov-ulugbek', name: "Barotov Ulug'bek", short: "Ulug'bek B.", group: 'A', photo: false },
  { id: 'oripova-kamola', name: 'Oripova Kamola', short: 'Kamola', group: 'A', photo: true },

  // ---- B guruh ----
  { id: 'abdiyozov-shodiyor', name: 'Abdiyozov Shodiyor', short: 'Shodiyor', group: 'B', photo: true },
  { id: 'abduakimov-alimjan', name: 'Abduakimov Alimjan', short: 'Alimjan', group: 'B', photo: true },
  { id: 'abdughanixojayev-umarxoja', name: "Abdug'anixo'jayev Umarxo'ja", short: "Umarxo'ja", group: 'B', photo: true },
  { id: 'abdumalikov-ravshanjon', name: 'Abdumalikov Ravshan', short: 'Ravshan', group: 'B', photo: true },
  { id: 'abdurahmonov-shahboz', name: 'Abdurahmonov Shahboz', short: 'Shahboz', group: 'B', photo: true },
  { id: 'akarsu-mehmetcan', name: 'Akarsu Mehmetcan', short: 'Mehmetcan', group: 'B', photo: true },
  { id: 'anvarjonov-yusufbek', name: 'Anvarjonov Yusufbek', short: 'Yusufbek', group: 'B', photo: true },
  { id: 'dadiljonova-samira', name: 'Dadiljonova Samira', short: 'Samira', group: 'B', photo: true },
  { id: 'isanov-suxrobbek', name: 'Isanov Suxrobbek', short: 'Suxrobbek', group: 'B', photo: true },
  { id: 'qobiljonova-ezoza', name: 'Qobiljonova Ezoza', short: 'Ezoza', group: 'B', photo: true },
  { id: 'saidkarimova-xonzoda', name: 'Saidkarimova Xonzoda', short: 'Xonzoda', group: 'B', photo: true },
  { id: 'tursunmamatov-barkamol', name: 'Tursunmamatov Barkamol', short: 'Barkamol', group: 'B', photo: true },
  { id: 'ulugbekov-ozodbek', name: "Ulug'bekov Ozodbek", short: 'Ozodbek U.', group: 'B', photo: true },
]

export const CATEGORIES = ['Roast', 'Rostini ayt', 'Kelajak', 'Xaos'] as const
export type Category = (typeof CATEGORIES)[number]

export type SeedQuestion = { text: string; emoji: string; category: Category }

// Boshlang'ich savollar — bazaga birinchi ishga tushishda yoziladi.
// Keyin har kim saytdan o'zgartirishi / o'chirishi / qo'shishi mumkin.
export const SEED_QUESTIONS: SeedQuestion[] = [
  // 🔥 Roast
  { emoji: '⏰', category: 'Roast', text: 'Kim "5 minutda yetib kelaman" deb, 1 soatdan keyin keladi?' },
  { emoji: '👻', category: 'Roast', text: 'Kim guruh chatida hammasini o\'qiydi, lekin umrida bir marta ham javob yozmagan?' },
  { emoji: '🤓', category: 'Roast', text: 'Kim domlaning har gapiga bosh qimirlatadi, lekin hech narsani tushunmaydi?' },
  { emoji: '🎭', category: 'Roast', text: 'Kim imtihondan oldin "men umuman o\'qimadim" deydi, keyin eng yuqori ball oladi?' },
  { emoji: '🎤', category: 'Roast', text: 'Kim bir og\'iz gap uchun 7 minutlik voice yuboradi?' },
  { emoji: '🔋', category: 'Roast', text: 'Kimning telefoni doim 2% zaryadda va "zaryadnik bormi?" deb yuradi?' },
  { emoji: '💸', category: 'Roast', text: 'Kim eng ko\'p "stipendiya qachon tushadi?" deb so\'raydi?' },
  { emoji: '🍽️', category: 'Roast', text: 'Kim "men to\'ymanman" deb, hammaning ovqatidan tatib chiqadi?' },

  // 😳 Rostini ayt
  { emoji: '🧠', category: 'Rostini ayt', text: 'Kim aslida guruhning yashirin lideri — hamma unga qarab qaror qiladi?' },
  { emoji: '🛡️', category: 'Rostini ayt', text: 'Kimga hayotingni ishonib topshirarding?' },
  { emoji: '🤐', category: 'Rostini ayt', text: 'Kimga hech qachon sir aytmas eding — ertasiga hamma bilib qoladi?' },
  { emoji: '🧊', category: 'Rostini ayt', text: 'Kim jahli chiqsa ham hech kimga bildirmaydi, ichida yig\'ib yuradi?' },
  { emoji: '🗡️', category: 'Rostini ayt', text: 'Kim bir og\'iz gap bilan kayfiyatingni buzib yubora oladi?' },
  { emoji: '☕', category: 'Rostini ayt', text: 'Kim bilan bir kun jim o\'tirsang ham zerikmaysan?' },
  { emoji: '👀', category: 'Rostini ayt', text: 'Kim yashirincha shu guruhdagi kimgadir oshiq?' },
  { emoji: '🎭', category: 'Rostini ayt', text: 'Kim befarq ko\'rinadi, lekin aslida hammani eng ko\'p o\'ylaydi?' },
  { emoji: '🍅', category: 'Rostini ayt', text: 'Kimga bitta ta\'rif aytsang, qizarib ketib gapini yo\'qotadi?' },

  // 🔮 Kelajak
  { emoji: '💍', category: 'Kelajak', text: 'Kim 30 yoshda ham "hali erta" deb uylanmaydi / turmushga chiqmaydi?' },
  { emoji: '🚗', category: 'Kelajak', text: 'Kim birinchi bo\'lib mashina oladi (kreditga bo\'lsa ham)?' },
  { emoji: '👨‍🏫', category: 'Kelajak', text: 'Kim 10 yildan keyin domla bo\'lib shu auditoriyaga qaytadi?' },
  { emoji: '🏙️', category: 'Kelajak', text: 'Kim Dubaydan "biznes qilyapman" deb story qo\'yadi, lekin nima biznes — hech kim bilmaydi?' },
  { emoji: '🏛️', category: 'Kelajak', text: 'Kim deputat bo\'ladi va bizni tanimaydi?' },
  { emoji: '📱', category: 'Kelajak', text: 'Kim TikTokda 1 million obunachi yig\'adi?' },
  { emoji: '✈️', category: 'Kelajak', text: 'Kim chet elga ketib, "sog\'indim" deb bir marta ham yozmaydi?' },

  // 💀 Xaos
  { emoji: '💰', category: 'Xaos', text: 'Kim butun guruhni 1 million dollarga sotadi va vijdoni umuman qiynalmaydi?' },
  { emoji: '🧟', category: 'Xaos', text: 'Kim zombi apokalipsisida birinchi 5 minutda o\'ladi?' },
  { emoji: '🕵️', category: 'Xaos', text: 'Kim "Mafiya" o\'yinida doim mafiya bo\'ladi va hech kim sezmaydi?' },
  { emoji: '🚔', category: 'Xaos', text: 'Kim politsiya to\'xtatsa "amakim general" deydi?' },
  { emoji: '🌙', category: 'Xaos', text: 'Kim tunda soat 3 da "uxlamadingmi?" deb yozadi?' },
]
