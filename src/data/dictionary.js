// Slovník běžných českých potravin a zboží → sekce supermarketu.
// Položky jsou oddělené čárkou; víceslovné názvy jsou povolené.
const RAW = {
  zelenina: `cibule, červená cibule, šalotka, česnek, pórek, jarní cibulka, brambory, batáty, mrkev, mrkve, mrkvička, petržel, celer,
    řapíkatý celer, pastinák, ředkvička, řepa, červená řepa, kedluben, zelí, červené zelí, kapusta, květák, brokolice,
    kapusta růžičková, rajče, rajčata, cherry rajčata, okurka, okurky, paprika, papriky, chilli, cuketa, lilek, dýně,
    hokkaido, salát, ledový salát, polníček, rukola, špenát, polníček, kukuřice, houby, žampiony, hlíva, avokádo,
    zázvor, bylinky, petrželka, pažitka, kopr, bazalka, máta, koriandr, rozmarýn, tymián, citron, citrony, limetka,
    pomeranč, pomeranče, mandarinky, grapefruit, jablko, jablka, hruška, hrušky, banán, banány, hroznové víno, hrozny,
    jahody, borůvky, maliny, ostružiny, rybíz, třešně, višně, meruňky, broskve, nektarinky, švestky, kiwi, ananas,
    mango, meloun, granátové jablko, fíky, datle, ovoce, zelenina, klíčky, fazolky, lusky`,
  pecivo: `chléb, chleba, rohlík, rohlíky, houska, housky, bageta, kaiserka, kaiserky, croissant, koblih, koblihy,
    buchta, buchty, vánočka, toustový chléb, toustový chleba, tortilla, tortilly, pita, kobliha, loupák, loupáky,
    šáteček, koláč, koláče, celozrnný chléb, knäckebrot, strouhanka, dalamánek, bulky, pečivo, štrúdl, závin`,
  maso: `maso, kuře, kuřecí, kuřecí prsa, kuřecí stehna, kuřecí křídla, krůtí, krůtí prsa, vepřové, vepřová plec,
    vepřová krkovice, krkovice, vepřová kýta, bůček, žebra, žebírka, hovězí, hovězí zadní, svíčková, mleté maso,
    mleté, telecí, jehněčí, kachna, husa, králík, játra, šunka, salám, klobása, klobásy, párky, párek, špekáčky,
    slanina, anglická slanina, uzené, uzené maso, debrecínka, tlačenka, jitrnice, jelito, paštika, vysočina, vlašský salát,
    sekaná, řízky, steak, kabanos, prosciutto, chorizo, šunka od kosti, sádlo, škvarky`,
  ryby: `ryba, ryby, losos, pstruh, kapr, treska, tuňák čerstvý, filé, krevety, mušle, chobotnice, sledě, makrela,
    uzená makrela, surimi, zavináče, rybí salát, kalamáry`,
  mlecne: `mléko, polotučné mléko, plnotučné mléko, laktózové mléko, máslo, smetana, šlehačka, smetana na vaření,
    zakysaná smetana, jogurt, jogurty, bílý jogurt, řecký jogurt, kefír, podmáslí, acidofilní mléko, tvaroh, cottage,
    pribináček, lučina, termix, puding, vejce, vajíčka, vajíčko, margarín, rama, žervé, skyr, mascarpone, ricotta, mlíko`,
  syry: `sýr, sýry, eidam, gouda, ementál, čedar, mozzarella, parmazán, niva, hermelín, camembert, brie, balkánský sýr,
    feta, tavený sýr, plátkový sýr, strouhaný sýr, olomoucké tvarůžky, tvarůžky, oštěpek, korbáčiky, halloumi, gorgonzola`,
  trvanlive: `těstoviny, špagety, penne, fusilli, vřetena, kolínka, lasagne, nudle, rýže, basmati, jasmínová rýže,
    kuskus, bulgur, quinoa, kvinoa, pohanka, jáhly, kroupy, čočka, fazole, cizrna, hrách, mouka, hladká mouka, polohrubá mouka,
    hrubá mouka, cukr, krupice, moučkový cukr, třtinový cukr, vanilkový cukr, prášek do pečiva, droždí, kypřicí prášek,
    ovesné vločky, vločky, müsli, cornflakes, cereálie, olej, olivový olej, slunečnicový olej, ocet, med, džem,
    marmeláda, nutella, arašídové máslo, sušené ovoce, rozinky, ořechy, vlašské ořechy, mandle, kešu, lněné semínko,
    chia, kokos, strouhaný kokos, knedlík, knedlíky, bramborová kaše, instantní polévka, polévka, bujón, kostky, sůl,
    želatina, škrob, solamyl, kakao, puding prášek, sušenky na pečení`,
  konzervy: `konzerva, konzervy, tuňák, sardinky, kukuřice v plechu, fazole v tomatě, loupaná rajčata, protlak,
    rajčatový protlak, passata, kečup, hořčice, majonéza, tatarka, tatarská omáčka, dresink, omáčka, sójová omáčka,
    pesto, kyselé okurky, okurky sterilované, olivy, kapary, kompot, ananas v plechu, broskve v plechu, hotové jídlo,
    sterilované zelí, kysané zelí, worcester, sriracha, tabasco, sladkokyselá omáčka`,
  koreni: `koření, pepř, paprika mletá, sladká paprika, kmín, majoránka, oregano, bobkový list, nové koření, skořice,
    hřebíček, muškátový oříšek, kari, kurkuma, chilli koření, grilovací koření, vegeta, provensálské koření, česnek
    sušený, badyán, vanilka, zázvor mletý, gulášové koření`,
  sladkosti: `čokoláda, čokolády, bonbony, žvýkačky, sušenky, oplatky, tatranky, horalky, bebe, piškoty, perník,
    tyčinka, müsli tyčinka, gumové bonbony, želé, lízátka, chipsy, brambůrky, tyčinky, slané tyčinky, preclíky, krekry,
    popcorn, arašídy, pistácie, zmrzlina kornout, dort, zákusek, zákusky, mňamky`,
  kava: `káva, zrnková káva, mletá káva, instantní káva, kapsle, čaj, černý čaj, zelený čaj, ovocný čaj, bylinný čaj,
    heřmánek, máta čaj, kakao nápoj, granko, cappuccino`,
  napoje: `voda, minerálka, perlivá voda, neperlivá voda, džus, pomerančový džus, jablečný džus, limonáda, kofola,
    cola, coca cola, pepsi, sprite, fanta, sirup, ledový čaj, energetický nápoj, tonik, smoothie, mošt, rostlinné mléko,
    ovesné mléko, sójové mléko, mandlové mléko`,
  alkohol: `pivo, piva, nealko pivo, víno, bílé víno, červené víno, růžové víno, prosecco, sekt, šampaňské, rum,
    vodka, whisky, gin, slivovice, becherovka, fernet, likér, griotka, aperol, cider, radler`,
  mrazene: `mražené, mražená zelenina, mražený hrášek, hrášek, mražené ovoce, zmrzlina, nanuk, nanuky, hranolky,
    pizza, mražená pizza, rybí prsty, špenát mražený, knedlíky mražené, pirohy, led, kroketky, mražené krevety`,
  drogerie: `toaletní papír, toaleťák, papírové kapesníky, kapesníky, mýdlo, tekuté mýdlo, sprchový gel, šampon,
    kondicionér, zubní pasta, zubní kartáček, ústní voda, nit, deodorant, deo, holítka, pěna na holení, krém,
    tělové mléko, opalovací krém, vatové tyčinky, odličovací tampony, vložky, tampony, pleny, plenky, vlhčené ubrousky,
    hřeben, lak na vlasy, gel na vlasy, náplasti, paralen, ibuprofen`,
  domacnost: `prášek na praní, prací gel, kapsle na praní, aviváž, jar, saponát, prostředek na nádobí, tablety do
    myčky, sůl do myčky, leštidlo, savo, domestos, čistič, čistič na okna, houbičky, houbička, hadr, hadry, utěrky,
    papírové utěrky, kuchyňské utěrky, alobal, potravinová fólie, pečicí papír, sáčky, pytle na odpadky, sáčky do koše,
    žárovka, svíčky, zápalky, sirky, ubrousky, kelímky, talíře papírové, krmivo, granule, kapsičky, stelivo,
    pivní tácky, gril uhlí, uhlí, podpalovač`,
  pokladna: `baterie, tužkové baterie, žvýkačka, mentolky, dárková karta, zapalovač, tic tac, kinder vajíčko, taška`,
};

export const DICTIONARY = Object.fromEntries(
  Object.entries(RAW).map(([sectionId, list]) => [
    sectionId,
    list.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
  ])
);

// Plochý seznam pro našeptávač.
export const ALL_WORDS = [...new Set(Object.values(DICTIONARY).flat())];
