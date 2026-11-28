# English UI pass for src/main.ts (American setting). Sultan's own lines stay Arabic.
import re
p='src/main.ts'; s=open(p).read()
T = [
('const VERSION = "v2.0 — المرحلة 1";','const VERSION = "v2.0 — Phase 1";\nexport const CUR = "$"; // currency symbol (single place to change)\nconst money = (n: number): string => CUR + Math.round(n).toLocaleString("en-US");'),
('{ n: "ماء", price: 2, hp: 6, cat: 0, ic: "💧" }, pepsi: { n: "بيبسي",','{ n: "Bottled Water", price: 2, hp: 6, cat: 0, ic: "💧" }, pepsi: { n: "Cola",'),
('juice: { n: "عصير برتقال"','juice: { n: "Orange Juice"'),('laban: { n: "لبن"','laban: { n: "Milk"'),('energy: { n: "مشروب طاقة"','energy: { n: "Energy Drink"'),
('chips: { n: "شيبس"','chips: { n: "Chips"'),('choco: { n: "شوكولاتة"','choco: { n: "Chocolate Bar"'),('dates: { n: "تمر", price: 8, hp: 18, cat: 1, ic: "🌴" }','dates: { n: "Granola Bar", price: 4, hp: 12, cat: 1, ic: "🥜" }'),('biscuit: { n: "بسكويت"','biscuit: { n: "Cookies"'),
('tuna: { n: "تونة"','tuna: { n: "Canned Tuna"'),('beans: { n: "فول"','beans: { n: "Baked Beans"'),('bread: { n: "خبز"','bread: { n: "Bread"'),('cheese: { n: "جبن"','cheese: { n: "Cheese"'),
('soap: { n: "صابون"','soap: { n: "Soap"'),('tissue: { n: "مناديل"','tissue: { n: "Paper Towels"'),
('[{ n: "شاورما", price: 15, hp: 30, ic: "🌯" }, { n: "برجر", price: 25, hp: 50, ic: "🍔" }, { n: "كبسة لحم", price: 40, hp: 100, ic: "🍛" }, { n: "عصير طازج", price: 6, hp: 12, ic: "🍹" }, { n: "قهوة عربية وتمر", price: 8, hp: 15, ic: "☕" }]',
 '[{ n: "Hot Dog", price: 6, hp: 20, ic: "🌭" }, { n: "Cheeseburger & Fries", price: 14, hp: 50, ic: "🍔" }, { n: "Pancake Stack", price: 10, hp: 35, ic: "🥞" }, { n: "Steak Dinner", price: 32, hp: 100, ic: "🥩" }, { n: "Milkshake", price: 6, hp: 12, ic: "🥤" }, { n: "Coffee & Donut", price: 5, hp: 15, ic: "☕" }]'),
('<div class="logo" style="font-size:54px">مدينة الفوضى</div>','<div class="logo" style="font-size:54px">CHAOS CITY<small>مدينة الفوضى</small></div>'),
('جاري تجهيز المدينة...','Preparing the city...'),
('<div class="logo">مدينة الفوضى<span class="shine">مدينة الفوضى</span><small>3D · عالم مفتوح</small></div>','<div class="logo" id="logoBox">CHAOS CITY<span class="shine">CHAOS CITY</span><small>مدينة الفوضى · Open World 3D</small></div>'),
('سلطان ينتظرك… المدينة ما تنام 🌆','Sultan is waiting… the city never sleeps 🌆'),
('ابدأ اللعب','Start Game'),('<span class="i">⟲</span>متابعة','<span class="i">⟲</span>Continue'),('<span class="i">⚙</span>الإعدادات','<span class="i">⚙</span>Settings'),('<span class="i">🎮</span>التحكم','<span class="i">🎮</span>Controls'),('<span class="i">ℹ</span>عن اللعبة','<span class="i">ℹ</span>About'),
('<h1>إيقاف مؤقت</h1>','<h1>Paused</h1>'),('متابعة اللعب','Resume'),('حفظ اللعبة','Save Game'),('القائمة الرئيسية','Main Menu'),
('<h2>الإعدادات</h2>','<h2>Settings</h2>'),('جودة الرسوميات','Graphics quality'),('>منخفضة<','>Low<'),('>متوسطة<','>Medium<'),('>عالية<','>High<'),
('حساسية الماوس / اليد','Mouse / gamepad sensitivity'),('مستوى الصوت','Volume'),('<span class="k">صوت سلطان</span>','<span class="k">Sultan\'s voice</span>'),('>شغّال<','>On<'),('>طافي<','>Off<'),
('عكس المحور الرأسي','Invert vertical axis'),('>لا<','>No<'),('>نعم<','>Yes<'),('<span class="k">الطقس</span>','<span class="k">Weather</span>'),('>تلقائي<','>Auto<'),('WEATHER_AR[w]','WEATHER_EN[w]'),
('رجوع</button>','Back</button>'),('<h2>التحكم</h2>','<h2>Controls</h2>'),('⌨️ الكيبورد والماوس','⌨️ Keyboard & mouse'),
('["E", "دخول المباني / تفاعل (وركوب السيارة إذا ما فيه باب قريب)"], ["R", "سرقة (داخل المحلات)"], ["T", "الجوال"], ["F9", "معلومات المطوّر"]','["E", "Enter buildings / interact (or get in a car)"], ["R", "Steal (inside stores)"], ["T", "Phone"], ["F9", "Developer info"]'),
('🎮 يد بلايستيشن','🎮 PlayStation controller'),('["△", "دخول المباني / تفاعل"], ["○", "سرقة / رجوع"], ["Share / لوحة اللمس", "الجوال"]','["△", "Enter buildings / interact"], ["○", "Steal / back"], ["Share / touchpad", "Phone"]'),
('<h2>عن اللعبة</h2>','<h2>About</h2>'),
('>الخريطة<','>Map<'),('>اتصل بسلطان<','>Call Sultan<'),('>الطقس<','>Weather<'),('>الكراج<','>Garage<'),('>الملابس<','>Clothes<'),('>حفظ<','>Save<'),('إغلاق</button>','Close</button>'),
('"تحميل الملفات..."','"Loading files..."'),('"تحميل المجسّمات..."','"Loading models..."'),('"بناء المدينة..."','"Building the city..."'),('"تجهيز الشخصيات..."','"Preparing characters..."'),('"جاهز"','"Ready"'),
('"💾 تم حفظ اللعبة"','"💾 Game saved"'),('"↩ رجوع"','"↩ Back"'),
('toast("سلطان: أنا برا أنتظرك 👋")','toast("سلطان: أنا برا أنتظرك 👋")'),('"📞 اتصلت بسلطان — جايك!"','"📞 Called Sultan — he\'s on his way!"'),
('phoneSub("الطقس", [{ t: "تلقائي (يتغيّر مع الوقت)"','phoneSub("Weather", [{ t: "Auto (changes over time)"'),('toast("الطقس: تلقائي")','toast("Weather: auto")'),('toast("الطقس: " + WEATHER_EN[w])','toast("Weather: " + WEATHER_EN[w])'),
('phoneSub("الكراج — سيارتي", [{ t: "🚙 جيب سيارتي (لاندكروزر)"','phoneSub("Garage — my car", [{ t: "🚙 Bring my car (SUV)"'),('["فضي", "أسود", "أبيض لؤلؤي", "عنابي", "أزرق ملكي", "ذهبي"]','["Silver", "Black", "Pearl White", "Burgundy", "Royal Blue", "Gold"]'),('"لون السيارة: تم"','"Car color updated"'),
('phoneSub("ملابسي",','phoneSub("My clothes",'),('toast("لبست: " + OUTFITS[o].n)','toast("Wearing: " + OUTFITS[o].n)'),('"🛍️ تشتري ملابس جديدة؟ روح محل الملابس (الشارع التجاري)"','"🛍️ New clothes? Visit the clothing store downtown"'),
('"اطلع برا أول"','"Go outside first"'),('n: "سيارتي (لاندكروزر)"','n: "My SUV"'),('"🚙 سيارتك وصلت جنبك"','"🚙 Your car is here"'),
('toast("الدكتور: صحتك ممتازة ما شاء الله 👨‍⚕️")','toast("Doctor: You\'re perfectly healthy 👨‍⚕️")'),('toast("العلاج بـ 50$ وما معك فلوس كافية")','toast("Treatment costs " + money(50) + " — not enough cash")'),('toast("🏥 تعالجت — 50$")','toast("🏥 Treated — " + money(50))'),
('toast("الكاشير: هلا والله! حيّاك 🛒")','toast("Cashier: Hey there! Welcome in 🛒")'),('toast("المطعم: أهلاً! وش تطلب؟")','toast("Waitress: Hi hon, what can I get you?")'),('toast("الاستقبال: مرحبا بك في فندق المدينة")','toast("Reception: Welcome to the hotel")'),('toast("🏠 بيتك — الثلاجة فيها مشترياتك")','toast("🏠 Home — your groceries are in the fridge")'),('toast("محل الملابس: تفضّل جرّب")','toast("Clothing store: Feel free to try things on")'),
('"🚨 الشرطة جاية بسبب السرقة!"','"🚨 The cops are coming for the theft!"'),('"شراء"','"Buy"'),('"استخدام"','"Use"'),('"سرقة 🤫"','"Steal 🤫"'),
('"فلوسك: $" + g.p.money.toLocaleString("en-US") + " · صحتك: "','"Cash: " + money(g.p.money) + " · Health: "'),
('["حرامي!! وقف مكانك!", "شفتك! بتصل على الشرطة الحين!", "يا شرطة! سرقة!", "رجّع الأغراض يا حرامي!"]','["Hey! Stop, thief!", "I saw that! I\'m calling the cops!", "Police! I\'m being robbed!", "Put that back, you punk!"]'),
('"الكاشير: "','"Cashier: "'),('["المشروبات", "السناكات", "المعلبات والخبز", "المنظفات"]','["Drinks", "Snacks", "Canned food & bread", "Household"]'),
('toast("سرقت " + ITEMS[k].n + " 🤫")','toast("Stole " + ITEMS[k].n + " 🤫")'),('"رف " + names[cat]','"Aisle: " + names[cat]'),('" صحة · في ثلاجتك: "','" health · in fridge: "'),('"للبيت"','"Household"'),
('"ما معك فلوس كافية"','"Not enough cash"'),('"اشتريت " + ITEMS[k].n + " — راح لثلاجة البيت 🧊"','"Bought " + ITEMS[k].n + " — sent to your fridge 🧊"'),
('"المطعم"','"Diner"'),('" صحة"','" health"'),('"شبعان! صحتك كاملة 😄"','"You\'re full! Health is maxed 😄"'),('"بالعافية! " + f.n + " 😋"','"Enjoy your " + f.n + " 😋"'),
('toast("الغرفة بـ 120$ وما معك فلوس كافية")','toast("A room is " + money(120) + " — not enough cash")'),('"نمت في الفندق… 💤"','"Slept at the hotel… 💤"'),('"نمت في بيتك… 💤"','"Slept at home… 💤"'),
('"الثلاجة فاضية 🥲 روح البقالة واشترِ أغراض"','"The fridge is empty 🥲 buy some groceries"'),('"🧊 الثلاجة"','"🧊 Fridge"'),('"هذا للتنظيف مو للأكل 😅"','"That\'s for cleaning, not eating 😅"'),('(ITEMS[k].cat === 0 ? "شربت " : "أكلت ")','(ITEMS[k].cat === 0 ? "Drank " : "Ate ")'),('ITEMS[k].cat === 0 ? "اشرب" : "كُل"','ITEMS[k].cat === 0 ? "Drink" : "Eat"'),
('"📺 التلفزيون شغّال" : "📺 طفّيت التلفزيون"','"📺 TV on" : "📺 TV off"'),('"👕 محل الملابس"','"👕 Clothing Store"'),('"عندك"','"Owned"'),('toast("اشتريت ولبست: " + o.n)','toast("Bought & wearing: " + o.n)'),('toast("لبست: " + o.n)','toast("Wearing: " + o.n)'),('useT: "البس"','useT: "Wear"'),
('"تم توصيل اليد 🎮"','"Controller connected 🎮"'),
('(d.kind === "hosp" ? "اضغط E / △ للعلاج (50$) — " + d.name : "اضغط E / △ للدخول — " + d.name)','(d.kind === "hosp" ? "Press E / △ for treatment (" + money(50) + ") — " + d.name : "Press E / △ to enter — " + d.name)'),
('"خطأ: "','"Error: "'),
]
miss=[]
for a,b in T:
    if a in s: s=s.replace(a,b)
    else: miss.append(a[:60])
open(p,'w').write(s)
print('missing', miss)
