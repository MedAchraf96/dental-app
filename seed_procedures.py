from app import create_app, db
from app.models import TreatmentCatalog # <-- CHANGE THIS LINE


app = create_app()

# Complete data extracted from Honoraires Minimaux (Using 2020 MinimumNV prices where available)
procedures_data = [
    # --- CONSULTATION & ACTES ISOLÉS ---
    {"name": "Consultation du médecin dentiste", "code": "CD", "cotation": "CD", "price": 40.0, "category": "Consultation", "target": "general"},
    {"name": "Acte Réalisé par un médecin dentiste", "code": "D", "cotation": "D", "price": 3.0, "category": "Consultation", "target": "general"},
    {"name": "Anesthésie Locale (isolée) sans acte", "code": "DCH000010", "cotation": "D 6", "price": 18.0, "category": "Actes Isolés", "target": "general"},
    {"name": "Anesthésie LocoRégionale (isolée) sans acte", "code": "DCH000020", "cotation": "D 10", "price": 30.0, "category": "Actes Isolés", "target": "general"},
    {"name": "Clichet Radio (isolé)", "code": "DCH000030", "cotation": "Z8", "price": 20.0, "category": "Actes Isolés", "target": "general"},
    {"name": "Clichets Radio > 6", "code": "DCH000040", "cotation": "Z25", "price": 45.0, "category": "Actes Isolés", "target": "general"},

    # --- CAVITÉS (FILLINGS) ---
    {"name": "Cavité simple: 1 Seule cavitation", "code": "DCH010010", "cotation": "D 15", "price": 45.0, "category": "Cavité Simple", "target": "single_tooth"},
    {"name": "Cavité simple: DPI Enfant < 14ans", "code": "DCH010020", "cotation": "D 18", "price": 54.0, "category": "Cavité Simple", "target": "single_tooth"},
    {"name": "Cavité simple: > 1 seule cavitation (supplément)", "code": "DCH010030", "cotation": "D 10", "price": 30.0, "category": "Cavité Simple", "target": "single_tooth"},
    {"name": "Cavité composée: 2 faces", "code": "DCH010040", "cotation": "D 23", "price": 69.0, "category": "Cavité Composée", "target": "single_tooth"},
    {"name": "Cavité composée: 2 faces si DPI Enfant < 14ans", "code": "DCH010050", "cotation": "D 26", "price": 78.0, "category": "Cavité Composée", "target": "single_tooth"},
    {"name": "Cavité composée: 3 faces", "code": "DCH010060", "cotation": "D 30", "price": 90.0, "category": "Cavité Composée", "target": "single_tooth"},
    {"name": "Cavité composée: 3 faces si DPI Enfant < 14ans", "code": "DCH010070", "cotation": "D 36", "price": 108.0, "category": "Cavité Composée", "target": "single_tooth"},

    # --- ENDO + OBC (ROOT CANALS) ---
    {"name": "Coiffage pulpaire / Pulpectomie coronaire simple", "code": "DCH010080", "cotation": "D 10", "price": 30.0, "category": "Endo + OBC", "target": "single_tooth"},
    {"name": "OBC: Groupe incisivo-canin", "code": "DCH010090", "cotation": "D 18", "price": 70.0, "category": "Endo + OBC", "target": "single_tooth"},
    {"name": "OBC: Groupe prémolaire", "code": "DCH010100", "cotation": "D 23", "price": 80.0, "category": "Endo + OBC", "target": "single_tooth"},
    {"name": "OBC: Groupe molaire", "code": "DCH010110", "cotation": "D 30", "price": 90.0, "category": "Endo + OBC", "target": "single_tooth"},
    {"name": "Tenon Fibré", "code": "DCH010120", "cotation": "D 50", "price": 130.0, "category": "Endo + OBC", "target": "single_tooth"},

    # --- GENCIVE & EXTRACTIONS SIMPLES ---
    {"name": "Résection de capuchon muqueux d'une dent de sagesse", "code": "DCH020010", "cotation": "D 10", "price": 30.0, "category": "Gencive", "target": "single_tooth"},
    {"name": "Incision d'abcès et drainage", "code": "DCH020020", "cotation": "D 10", "price": 30.0, "category": "Gencive", "target": "single_tooth"},
    {"name": "Extraction simple", "code": "DCH020030", "cotation": "D 15", "price": 40.0, "category": "Extraction dentaire", "target": "single_tooth"},
    {"name": "Majoration ++ pour chaque dent supp en meme séance", "code": "DCH020040", "cotation": "D 5", "price": 15.0, "category": "Extraction dentaire", "target": "single_tooth"},
    
    # --- EXO EN ACCIDENT INFLAMMATOIRE AIGUE ---
    {"name": "Extraction (Majoration) 1ere", "code": "DCH020050", "cotation": "D 6", "price": 18.0, "category": "Exo accident inflammatoire", "target": "single_tooth"},
    {"name": "Extraction (Majoration) ++ pour chaque dent supp", "code": "DCH020060", "cotation": "D 3", "price": 9.0, "category": "Exo accident inflammatoire", "target": "single_tooth"},
    {"name": "Extraction: Racines dentaires", "code": "DCH020070", "cotation": "D 20", "price": 60.0, "category": "Extraction dentaire", "target": "single_tooth"},
    {"name": "Extraction: Dent en malposition", "code": "DCH020080", "cotation": "D 20", "price": 60.0, "category": "Extraction dentaire", "target": "single_tooth"},
    {"name": "Tamponnement de l'hémorragie (suture) dans une autre séance", "code": "DCH020090", "cotation": "D 10", "price": 30.0, "category": "Extraction dentaire", "target": "single_tooth"},

    # --- EXTRACTION CHIRURGICALE ---
    {"name": "Extraction Chirurgicale: Dent enclavée", "code": "DCH020100", "cotation": "D 40", "price": 130.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},
    {"name": "Extraction Chirurgicale: Dent incluse", "code": "DCH020110", "cotation": "D 60", "price": 160.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},
    {"name": "Extraction Chirurgicale: D'un odontoïde", "code": "DCH020120", "cotation": "D 50", "price": 150.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},
    {"name": "Extraction: Dent en désinclusion désencalvement partiellement", "code": "DCH020130", "cotation": "D 25", "price": 75.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},
    {"name": "Extraction: Dent en désinclusion position linguale", "code": "DCH020140", "cotation": "D 40", "price": 120.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},
    {"name": "Extraction: Dent ectopique et incluse", "code": "DCH020150", "cotation": "D 80", "price": 240.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},
    {"name": "Germectomie", "code": "DCH020160", "cotation": "D 30", "price": 90.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},
    {"name": "Germectomie d'une dent de sagesse", "code": "DCH020170", "cotation": "D 50", "price": 150.0, "category": "Extraction Chirurgicale", "target": "single_tooth"},

    # --- EXO CHIR INCLUSE / TTT RAD / RÉIMPLANT ---
    {"name": "Exo Chir incluse/ttt rad/réimplan: Une dent", "code": "DCH020180", "cotation": "D 100", "price": 300.0, "category": "Chirurgie Incluse/Implant", "target": "single_tooth"},
    {"name": "Exo Chir incluse/ttt rad/réimplan: Deux dents", "code": "DCH020190", "cotation": "D 150", "price": 450.0, "category": "Chirurgie Incluse/Implant", "target": "single_tooth"},
    {"name": "Dégagement chirurgical de la couronne d'une dent permanente incluse", "code": "DCH020200", "cotation": "D 40", "price": 120.0, "category": "Chirurgie Incluse/Implant", "target": "single_tooth"},
    {"name": "Régularisation localisée d'une crête alvéolaire", "code": "DCH020210", "cotation": "D 15", "price": 45.0, "category": "Chirurgie Incluse/Implant", "target": "single_tooth"},
    {"name": "Régularisation étendue de la crête alvéolaire (y compris suture)", "code": "DCH020220", "cotation": "D 20", "price": 60.0, "category": "Chirurgie Incluse/Implant", "target": "single_tooth"},
    {"name": "Régularisation de crête concernant un hémimaxillaire", "code": "DCH020230", "cotation": "D 30", "price": 90.0, "category": "Chirurgie Incluse/Implant", "target": "single_tooth"},
    {"name": "Curetage périapical par trépanation vestibulaire (traitement du canal compris)", "code": "DCH020240", "cotation": "D 40", "price": 120.0, "category": "Chirurgie Incluse/Implant", "target": "single_tooth"},

    # --- EXERESE CHIRURGICALE D'UN KYSTE ---
    {"name": "Kyste de petit volume par voie alvéolaire élargie", "code": "DCH020250", "cotation": "D 20", "price": 60.0, "category": "Exérèse Kyste", "target": "single_tooth"},
    {"name": "Kyste étendu aux apex de deux dents", "code": "DCH020260", "cotation": "D 30", "price": 90.0, "category": "Exérèse Kyste", "target": "single_tooth"},
    {"name": "Kyste étendu à un segment important du maxillaire", "code": "DCH020270", "cotation": "D 60", "price": 180.0, "category": "Exérèse Kyste", "target": "single_tooth"},
    {"name": "Kyste corono-dentaire", "code": "DCH020280", "cotation": "D 40", "price": 120.0, "category": "Exérèse Kyste", "target": "single_tooth"},
    {"name": "Cure d'un kyste par marsupialisation", "code": "DCH020290", "cotation": "D 25", "price": 75.0, "category": "Exérèse Kyste", "target": "single_tooth"},

    # --- CHIRURGIE PRÉ-PROTHÉTIQUE ---
    {"name": "Désinsertion musculaire vestibulaire partielle", "code": "DCH020300", "cotation": "D 50", "price": 150.0, "category": "Chirurgie Pré-prothétique", "target": "general"},
    {"name": "Désinsertion musculaire étendue à tout le vestibule", "code": "DCH020310", "cotation": "D 60", "price": 180.0, "category": "Chirurgie Pré-prothétique", "target": "general"},
    {"name": "Désinsertion musculaire du plancher de la bouche", "code": "DCH020320", "cotation": "D 80", "price": 240.0, "category": "Chirurgie Pré-prothétique", "target": "general"},
    {"name": "Approfondissement d'un vestibule par greffe cutanée", "code": "DCH020330", "cotation": "D 50", "price": 150.0, "category": "Chirurgie Pré-prothétique", "target": "general"},
    {"name": "Désépaississement d'une crête flotante ou hyperplasie localisée", "code": "DCH020340", "cotation": "D 30", "price": 90.0, "category": "Chirurgie Pré-prothétique", "target": "general"},
    {"name": "Désépaississement d'une crête flotante ou hyperplasie étendue", "code": "DCH020350", "cotation": "D 40", "price": 120.0, "category": "Chirurgie Pré-prothétique", "target": "general"},

    # --- PARTIE MOLLES, GLANDES, MAXILLAIRES ---
    {"name": "Incision d'abcès de la langue ou du plancher de la bouche", "code": "DCH020360", "cotation": "D 20", "price": 60.0, "category": "Parties Molles", "target": "general"},
    {"name": "Excision et suture d'une bride fibreuse ou du frein hypertrophié", "code": "DCH020370", "cotation": "D 20", "price": 60.0, "category": "Parties Molles", "target": "general"},
    {"name": "Incision d'un abcès ou phlegmon de la base de la langue", "code": "DCH020380", "cotation": "D 40", "price": 120.0, "category": "Parties Molles", "target": "general"},
    {"name": "Excision par voie buccale d'un kyste du plancher de la bouche", "code": "DCH020390", "cotation": "D 30", "price": 90.0, "category": "Parties Molles", "target": "general"},
    {"name": "Injection de substance de contraste dans les glandes salivaires", "code": "DCH020400", "cotation": "D 15", "price": 45.0, "category": "Parties Molles", "target": "general"},
    {"name": "Ttt chir lithiase salivaire ablation calcul ant", "code": "DCH020410", "cotation": "D 20", "price": 60.0, "category": "Parties Molles", "target": "general"},
    {"name": "Ttt chir lithiase salivaire ablation calcul post", "code": "DCH020420", "cotation": "D 30", "price": 90.0, "category": "Parties Molles", "target": "general"},
    {"name": "Ttt chir d'une lésion bénigne d'une glande salivaire", "code": "DCH020430", "cotation": "D 50", "price": 150.0, "category": "Parties Molles", "target": "general"},
    {"name": "Ttt des fractures des procès alvéolaires", "code": "DCH020440", "cotation": "D 50", "price": 150.0, "category": "Parties Molles", "target": "general"},
    {"name": "Ttt orthopédique d'une fracture complète sans déplacement", "code": "DCH020450", "cotation": "D 60", "price": 180.0, "category": "Parties Molles", "target": "general"},
    {"name": "Curetage et ablation des séquestres pour ostéites", "code": "DCH020460", "cotation": "D 25", "price": 75.0, "category": "Parties Molles", "target": "general"},
    {"name": "Ttt orthopédique de luxation uni ou bilatérale récente de la mandibule", "code": "DCH020470", "cotation": "D 20", "price": 60.0, "category": "Parties Molles", "target": "general"},
    {"name": "Prélèvement en vue d'un examen de laboratoire", "code": "DCH020480", "cotation": "D 15", "price": 45.0, "category": "Parties Molles", "target": "general"},
    {"name": "Exérèse d'une tumeur bénigne de la muqueuse buccale (épulis)", "code": "DCH020490", "cotation": "D 25", "price": 75.0, "category": "Parties Molles", "target": "general"},
    {"name": "Diathermo-coagulation d'une leucoplasie, d'un lupus ou d'une tumeur bénigne", "code": "DCH020500", "cotation": "D 15", "price": 45.0, "category": "Parties Molles", "target": "general"},

    # --- TRAUMATISMES ---
    {"name": "Contention sur arc d'une dent subluxée, après réduction", "code": "DCH020510", "cotation": "D 80", "price": 240.0, "category": "Traumatismes", "target": "single_tooth"},
    {"name": "Contention sur arc de deux dents subluxées ou plus", "code": "DCH020520", "cotation": "D 100", "price": 300.0, "category": "Traumatismes", "target": "single_tooth"},
    {"name": "Contention d'une fracture alvéolodentaire du groupe incisivo-canin", "code": "DCH020530", "cotation": "D 120", "price": 360.0, "category": "Traumatismes", "target": "single_tooth"},
    {"name": "Ttt orthopédique d'une fracture mandibulaire non déplacée", "code": "DCH020540", "cotation": "D 150", "price": 450.0, "category": "Traumatismes", "target": "general"},
    {"name": "Blocage bimaxillaire sur arcs max et mand", "code": "DCH020550", "cotation": "D 200", "price": 600.0, "category": "Traumatismes", "target": "general"},

    # --- PARODONTOLOGIE (DÉTARTRAGE & GINGIVECTOMIE) ---
    {"name": "Détartrage complet sus (quelque soit le nombre de séances)", "code": "DCH030010", "cotation": "D 20", "price": 90.0, "category": "Parodontologie", "target": "general"},
    {"name": "Ttt des gingivites : détartrage, curetage et surfaçage radiculaire", "code": "DCH030020", "cotation": "D 25", "price": 70.0, "category": "Parodontologie", "target": "general"},
    {"name": "Gingivectomie Partielle", "code": "DCH030030", "cotation": "D 25", "price": 50.0, "category": "Parodontologie", "target": "general"},
    {"name": "Gingivectomie Etendue à une hémi arcade ou de canine à canine", "code": "DCH030040", "cotation": "D 50", "price": 100.0, "category": "Parodontologie", "target": "general"},
    {"name": "Intervention à lambeaux avec curetage (1 à 3 dents)", "code": "DCH030050", "cotation": "D 50", "price": 150.0, "category": "Parodontologie", "target": "single_tooth"},
    {"name": "Intervention à lambeaux (Par dent supplémentaire)", "code": "DCH030060", "cotation": "D 20", "price": 60.0, "category": "Parodontologie", "target": "single_tooth"},
    {"name": "Intervention à lambeau et traitement d'une lésion osseuse", "code": "DCH030070", "cotation": "D 150", "price": 450.0, "category": "Parodontologie", "target": "general"},
    {"name": "Greffe gingivale libre", "code": "DCH030080", "cotation": "D 150", "price": 300.0, "category": "Parodontologie", "target": "general"},
    {"name": "Hémi-section d'une molaire inférieure ou amputation radiculaire", "code": "DCH030090", "cotation": "D 35", "price": 105.0, "category": "Parodontologie", "target": "single_tooth"},
    {"name": "Ligature métallique dans les parodontopathies", "code": "DCH030100", "cotation": "D 25", "price": 75.0, "category": "Parodontologie", "target": "single_tooth"},
    {"name": "Attelle métallique dans les parodontopathies", "code": "DCH030110", "cotation": "D 40", "price": 120.0, "category": "Parodontologie", "target": "single_tooth"},
    {"name": "Prothèse attelle de contention", "code": "DCH030120", "cotation": "D 70", "price": 210.0, "category": "Parodontologie", "target": "single_tooth"},
    {"name": "Modification de l'articulé par meulage sélectif", "code": "DCH030130", "cotation": "D 75", "price": 225.0, "category": "Parodontologie", "target": "general"},
    {"name": "Frénectomie (excision du frein labial)", "code": "DCH030140", "cotation": "D 50", "price": 150.0, "category": "Parodontologie", "target": "general"},

    # --- PÉDODONTIE & PRÉVENTION ---
    {"name": "Couronne pédodontique préformée", "code": "DCH040010", "cotation": "D 30", "price": 110.0, "category": "Pédodontie", "target": "single_tooth"},
    {"name": "Résine de scellement des puits et fissures (scéalents)", "code": "DCH040020", "cotation": "D 15", "price": 80.0, "category": "Pédodontie", "target": "single_tooth"},
    {"name": "Application topique de fluor par gouttière préfabriquée (par séance)", "code": "DCH040030", "cotation": "D 10", "price": 30.0, "category": "Pédodontie", "target": "general"},
    {"name": "Application topique de fluor par gouttière thermoformée", "code": "DCH040040", "cotation": "D 35", "price": 105.0, "category": "Pédodontie", "target": "general"},
    {"name": "Mainteneur d'espace fixe", "code": "DCH040050", "cotation": "D 35", "price": 160.0, "category": "Pédodontie", "target": "single_tooth"},
    {"name": "Appareillage fixe pour blocage d'éruption", "code": "DCH040060", "cotation": "D 50", "price": 150.0, "category": "Pédodontie", "target": "single_tooth"},
    {"name": "Guide d'éruption", "code": "DCH040070", "cotation": "D 50", "price": 150.0, "category": "Pédodontie", "target": "single_tooth"},
    {"name": "Appareil d'interception mobile (suivi max 12 mois)", "code": "DCH040080", "cotation": "D 200", "price": 800.0, "category": "Pédodontie", "target": "general"},

    # --- EXAMEN & ORTHODONTIE ---
    {"name": "Examen avec prise d'empreintes diagnostic", "code": "DCH050010", "cotation": "D 20", "price": 60.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Analyse céphalométrique (en supplément)", "code": "DCH050020", "cotation": "D 15", "price": 45.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Traitement préventif par dispositif orthopédique", "code": "DCH050030", "cotation": "D 250", "price": 750.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Rééducation du comportement musculaire (par série de 12 séances)", "code": "DCH050040", "cotation": "D 8", "price": 24.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Traitement ortho simple ne dépassant pas 12 mois", "code": "DCH050050", "cotation": "D 200", "price": 600.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Traitement ortho simple ne dépassant pas 6 mois", "code": "DCH050060", "cotation": "D 300", "price": 900.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Ttt dysmorphoses importantes - Première année", "code": "DCH050070", "cotation": "D 350", "price": 1000.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Ttt dysmorphoses importantes - Deuxième année", "code": "DCH050080", "cotation": "D 350", "price": 1000.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Ttt dysmorphoses importantes - Troisième année", "code": "DCH050090", "cotation": "D 350", "price": 1000.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Contention après traitement orthodontique - 1ère année", "code": "DCH050100", "cotation": "D 100", "price": 300.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Contention après traitement orthodontique - 2ème année", "code": "DCH050110", "cotation": "D 50", "price": 150.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Disjonction intermaxillaire rapide", "code": "DCH050120", "cotation": "D 180", "price": 540.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "MESA: Mise en place sur l'arcade d'une dent permanente incluse", "code": "DCH050130", "cotation": "D 150", "price": 450.0, "category": "Examen & Orthodontie", "target": "single_tooth"},
    {"name": "MESA: Mise en place sur l'arcade de deux dents permanentes incluses", "code": "DCH050140", "cotation": "D 200", "price": 600.0, "category": "Examen & Orthodontie", "target": "single_tooth"},
    {"name": "Orthopédie de la fente labiopalatine - Forfait annuel", "code": "DCH050150", "cotation": "D 250", "price": 750.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Orthopédie de la fente labiopalatine - Période d'attente", "code": "DCH050160", "cotation": "D 60", "price": 180.0, "category": "Examen & Orthodontie", "target": "general"},
    {"name": "Préparation orthodontique à la chirurgie orthognathique", "code": "DCH050170", "cotation": "D 350", "price": 1050.0, "category": "Examen & Orthodontie", "target": "general"},

    # --- PROTHÈSES DENTAIRES ADJOINTES (REMOVABLE) ---
    {"name": "PPA: 1 - 3 dents", "code": "DCH060010", "cotation": "D 60", "price": 140.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "PPA: 4 - 7 dents (supplément par dent)", "code": "DCH060020", "cotation": "D 5", "price": 30.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "PPA: 8 dents", "code": "DCH060030", "cotation": "D 100", "price": 280.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "PPA: 9 - 11 dents (supplément par dent)", "code": "DCH060040", "cotation": "D 5", "price": 30.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "PPA: 12 - 14 dents", "code": "DCH060050", "cotation": "D 150", "price": 420.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "PT: appareillage complet haut et bas", "code": "DCH060060", "cotation": "D 300", "price": 840.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "Dent prothétique contre-plaquée sur plaque base plastique (supplément)", "code": "DCH060070", "cotation": "D 15", "price": 45.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Plaque base métallique coulée (supplément)", "code": "DCH060080", "cotation": "D 100", "price": 300.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "Dent prothétique contreplaquée ou massive soudée sur plaque base métallique", "code": "DCH060090", "cotation": "D 20", "price": 60.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Réparation de fracture sur la plaque base en matière plastique", "code": "DCH060100", "cotation": "D 15", "price": 45.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "Dents ou crochets ajoutés sur appareil plastique (Premier élément)", "code": "DCH060110", "cotation": "D 15", "price": 45.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Dents ou crochets ajoutés sur appareil plastique (Elément suivant)", "code": "DCH060120", "cotation": "D 5", "price": 15.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Dents ou crochets soudés sur appareil métallique (par élément)", "code": "DCH060130", "cotation": "D 20", "price": 60.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Réparation de fracture de la plaque base métallique", "code": "DCH060140", "cotation": "D 20", "price": 60.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "Dents ou crochets remontés sur matière plastique", "code": "DCH060150", "cotation": "D 5", "price": 15.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Rebasage", "code": "DCH060160", "cotation": "D 25", "price": 75.0, "category": "Prothèses Adjointes", "target": "arch"},
    {"name": "Prothèse avec attachement (par élément)", "code": "DCH060170", "cotation": "D 140", "price": 220.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Remplacement de facette ou dent à tube", "code": "DCH060180", "cotation": "D 15", "price": 45.0, "category": "Prothèses Adjointes", "target": "single_tooth"},
    {"name": "Préparation dentaire pro prothétique pour plaque métallique", "code": "DCH060190", "cotation": "D 50", "price": 150.0, "category": "Prothèses Adjointes", "target": "single_tooth"},

    # --- PROTHÈSES DENTAIRES CONJOINTE (FIXED) ---
    {"name": "Couronne dentaire et élément de bridge en alliage non précieux", "code": "DCH060200", "cotation": "D 55", "price": 130.0, "category": "Prothèses Conjointes", "target": "single_tooth"},
    {"name": "Dent à tenon ne faisant pas intervenir une technique de coulée", "code": "DCH060210", "cotation": "D 40", "price": 120.0, "category": "Prothèses Conjointes", "target": "single_tooth"},
    {"name": "Dent à tenon radiculaire faisant intervenir une technique de coulée", "code": "DCH060220", "cotation": "D 50", "price": 150.0, "category": "Prothèses Conjointes", "target": "single_tooth"},
    {"name": "Reconstitution coulée de moignon", "code": "DCH060230", "cotation": "D 50", "price": 150.0, "category": "Prothèses Conjointes", "target": "single_tooth"},
    {"name": "Dépose et/ou repose d'une prothèse fixe: par élément pilier", "code": "DCH060240", "cotation": "D 15", "price": 45.0, "category": "Prothèses Conjointes", "target": "single_tooth"},

    # --- ANALYSE & EQUILIBRATION ---
    {"name": "Analyse occlusale", "code": "DCH70010", "cotation": "D 120", "price": 360.0, "category": "Analyse & Equilibration", "target": "general"},
    {"name": "Equilibration: Par Soustraction (-) Meulage", "code": "DCH70020", "cotation": "D 70", "price": 210.0, "category": "Analyse & Equilibration", "target": "general"},
    {"name": "Equilibration: Par Addition (+) Résine composite", "code": "DCH70030", "cotation": "D 100", "price": 300.0, "category": "Analyse & Equilibration", "target": "single_tooth"},
    {"name": "Gouttière occlusale (ttt, mise en place et suivi)", "code": "DCH70040", "cotation": "D 200", "price": 400.0, "category": "Analyse & Equilibration", "target": "general"},
    {"name": "Réduction des subluxations et des luxations discales temporo-mandibulaires", "code": "DCH70050", "cotation": "D 50", "price": 150.0, "category": "Analyse & Equilibration", "target": "general"},

    # --- ESTHÉTIQUE & IMPLANTOLOGIE ---
    {"name": "Blanchiment par voie externe (max 5 séances) par séance", "code": "DCH80010", "cotation": "D 40", "price": 100.0, "category": "Esthétique", "target": "general"},
    {"name": "Blanchiment par voie interne (max 3 séances) par dent et par séance", "code": "DCH80020", "cotation": "D 30", "price": 170.0, "category": "Esthétique", "target": "single_tooth"},
    {"name": "Chirurgie de mise en place d'un implant (implant non compris)", "code": "DCH90010", "cotation": "D 200", "price": 800.0, "category": "Implantologie", "target": "single_tooth"},
    {"name": "Par implant supplémentaire", "code": "DCH90020", "cotation": "D 70", "price": 210.0, "category": "Implantologie", "target": "single_tooth"},
    {"name": "Réalisation d'une prothèse implanto-portée (par élément)", "code": "DCH90030", "cotation": "D 100", "price": 800.0, "category": "Implantologie", "target": "single_tooth"},
]

with app.app_context():
    print("🌱 Seeding database with complete Tunisian treatments...")
    count = 0
    for p in procedures_data:
        # CHANGE THIS to TreatmentCatalog
        if not TreatmentCatalog.query.filter_by(code=p['code']).first():
            new_proc = TreatmentCatalog(
                name=p['name'],
                code=p['code'],
                cotation=p['cotation'],
                default_price=p['price'],
                category=p['category'],
                target_type=p['target']
            )
            db.session.add(new_proc)
            count += 1
    
    db.session.commit()
    print(f"✅ Successfully added {count} treatments to the database!")