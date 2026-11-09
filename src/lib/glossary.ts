/** Jedan izvor istine za objašnjenja pojmova (inline „Term” i Pomoć). */
export const GLOSSARY: Record<string, { term: string; text: string }> = {
  zb: { term: 'ZB (zapovjedni bodovi)', text: 'Dnevni limit naredbi. Napad, sabotaža i istraživanje 3, gradnja/obrana/špijunaža/diplomacija 2, novačenje i trgovina 1.' },
  stabilnost: { term: 'Stabilnost', text: 'Raspoloženje naroda. Pada zbog visokih poreza, gladi i poraza; ispod 30 prijeti pobuna, a ispod 40 slabi proizvodnja.' },
  opskrba: { term: 'Opskrba', text: 'Teritorij mora biti lancem tvojih teritorija povezan s glavnim gradom. Odsječen teritorij ne proizvodi, a vojska u njemu slabi.' },
  magla: { term: 'Magla rata', text: 'Tuđu vojsku vidiš samo kao procjenu (~). Špijunaža podiže pouzdanost, ali savršenih podataka nema.' },
  otpor: { term: 'Otpor', text: 'Ako padne glavni grad, ne ispadaš: ulaziš u Otpor s jeftinim novačenjem i mogućnošću ustanka za povratak.' },
  cilj: { term: 'Tajni cilj', text: 'Skriven do kraja; ispunjen donosi 5 bodova. Otkriva se tek u završnom poretku.' },
  gospodarstvo: { term: 'Gospodarstvo', text: 'Bruto dnevni prihod (proizvodnja + porezi) donosi do 6 bodova — ali još važnije: bez zlata, željeza i hrane nema vojske, a bez vojske nema teritorija.' },
  podne: { term: 'Podnevno razrješenje', text: 'Usred dana (zadano 13:00) stižu rezultati špijunaže i diplomatske ponude, pa ih možeš iskoristiti za večernje odluke. Napadi, gradnja i novačenje razrješavaju se tek navečer.' },
  razrjesenje: { term: 'Razrješenje', text: 'U zadani trenutak (ili čim su svi spremni) server istovremeno izvršava naredbe svih igrača. Redoslijed klikanja ne znači ništa.' },
  obrana: { term: 'Obrana', text: 'Bonus branitelja: razina obrane, utvrde i glavni grad. Utvrđivanje daje dodatni bonus samo tu rundu.' },
  formacija: { term: 'Formacija', text: 'Raspored vojske u bitci. Klin: više napada, manje obrane. Falanga: obrnuto. Linija: uravnoteženo.' },
  osveta: { term: 'Osveta', text: 'Tko te napadne, kod tebe ostavlja dug. Kad uzvratiš napad, dobivaš bonus napada dok se dug ne naplati.' },
  ugled: { term: 'Ugled', text: 'Javni pokazatelj koliko se vjeruje tvojoj riječi. Kršenje saveza ga ruši, a poštovanje sporazuma gradi.' },
};
