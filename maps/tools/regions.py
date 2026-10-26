"""The ten house regions (matching the Destinations menu on wildearthstays.com).

Used by build_destination.py (map data) and build_region_pages.py (the /stays/<slug>/ pages).
Country names in `home` are Natural Earth names; `countries` are (display name, Natural Earth name).
"""

AFRICA = ["Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", "Central African Rep.", "Chad",
          "Comoros", "Congo", "Côte d'Ivoire", "Dem. Rep. Congo", "Djibouti", "Egypt", "Eq. Guinea", "Eritrea", "eSwatini", "Ethiopia",
          "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali",
          "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "S. Sudan", "São Tomé and Principe",
          "Senegal", "Seychelles", "Sierra Leone", "Somalia", "Somaliland", "South Africa", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda",
          "W. Sahara", "Zambia", "Zimbabwe"]
ASIA = ["Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Hong Kong", "India", "Indonesia", "Japan", "Laos", "Macao", "Malaysia",
        "Maldives", "Mongolia", "Myanmar", "Nepal", "North Korea", "Philippines", "Singapore", "South Korea", "Sri Lanka", "Taiwan",
        "Thailand", "Timor-Leste", "Vietnam"]
CENTRAL = ["Belize", "Guatemala", "Honduras", "El Salvador", "Nicaragua", "Costa Rica", "Panama"]
CARIB = ["Mexico", "Bahamas", "Cuba", "Jamaica", "Haiti", "Dominican Rep.", "Puerto Rico", "Turks and Caicos Is.", "Cayman Is.",
         "British Virgin Is.", "U.S. Virgin Is.", "Anguilla", "St-Martin", "Sint Maarten", "St-Barthélemy", "Antigua and Barb.",
         "St. Kitts and Nevis", "Montserrat", "Dominica", "Saint Lucia", "St. Vin. and Gren.", "Barbados", "Grenada",
         "Trinidad and Tobago", "Aruba", "Curaçao", "Bermuda"]
OCEANIA = ["Australia", "New Zealand", "Fiji", "Fr. Polynesia", "New Caledonia", "Vanuatu", "Solomon Is.", "Papua New Guinea", "Samoa",
           "American Samoa", "Tonga", "Cook Is.", "Niue", "Kiribati", "Tuvalu", "Wallis and Futuna Is.", "Palau", "Micronesia",
           "Marshall Is.", "Nauru", "Guam", "N. Mariana Is.", "Norfolk Island", "Pitcairn Is."]
SOUTH = ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay",
         "Venezuela", "Falkland Is."]
EUROPE = ["Albania", "Andorra", "Austria", "Belgium", "Bosnia and Herz.", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia",
          "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania",
          "Luxembourg", "Macedonia", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "Norway", "Poland", "Portugal", "Romania",
          "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "United Kingdom", "Iceland", "Faeroe Is.",
          "Isle of Man", "Guernsey", "Jersey", "Gibraltar", "Vatican", "Åland", "Turkey", "Georgia", "Armenia"]

REGIONS = {
    # slug: name, bbox [w,s,e,n], home, relief zoom, hero (Cloudinary id, alt), countries for the chips (display, Natural Earth)
    "africa": dict(name="Africa", bbox=[-19.0, -36.0, 53.0, 38.0], home=AFRICA, z=5,
        hero=("GettyImages-578876890", "Hot-air balloon rising over acacia savanna at first light"),
        countries=[("South Africa", "South Africa"), ("Botswana", "Botswana"), ("Kenya", "Kenya"), ("Tanzania", "Tanzania"),
                   ("Zambia", "Zambia"), ("Zimbabwe", "Zimbabwe"), ("Namibia", "Namibia"), ("Rwanda", "Rwanda"), ("Uganda", "Uganda"),
                   ("Madagascar", "Madagascar"), ("Mozambique", "Mozambique"), ("Morocco", "Morocco"), ("Egypt", "Egypt"),
                   ("Seychelles", "Seychelles"), ("Mauritius", "Mauritius")]),
    "asia": dict(name="Asia", bbox=[62.0, -11.5, 150.0, 46.0], home=ASIA, z=4,
        hero=("GettyImages-2154340100", "Limestone islands and turquoise channels seen from a ridge above the sea"),
        countries=[("Indonesia", "Indonesia"), ("Japan", "Japan"), ("Thailand", "Thailand"), ("Vietnam", "Vietnam"),
                   ("Cambodia", "Cambodia"), ("Philippines", "Philippines"), ("Malaysia", "Malaysia"), ("India", "India"),
                   ("Sri Lanka", "Sri Lanka"), ("Maldives", "Maldives"), ("Bhutan", "Bhutan"), ("Nepal", "Nepal"), ("Laos", "Laos")]),
    "usa-canada": dict(name="USA & Canada", bbox=[-170.0, 17.5, -50.0, 72.0], home=["United States of America", "Canada"], z=4,
        hero=("GettyImages-1462563623", "Sandstone towers glowing at golden hour"),
        countries=[("United States", "United States of America"), ("Canada", "Canada")]),
    "central-america": dict(name="Central America", bbox=[-93.0, 6.5, -76.5, 18.8], home=CENTRAL, z=6,
        hero=("GettyImages-1169946098", "A red-eyed tree frog on a rainforest stem"),
        countries=[(n, n) for n in CENTRAL]),
    "caribbean-mexico": dict(name="Caribbean & Mexico", bbox=[-118.0, 13.5, -59.0, 32.8], home=CARIB, z=5,
        hero=("GettyImages-910074300", "A palm-fringed cove beneath a forested volcanic peak"),
        countries=[("Mexico", "Mexico"), ("The Bahamas", "Bahamas"), ("St. Barthélemy", "St-Barthélemy"), ("Turks & Caicos", "Turks and Caicos Is."),
                   ("Saint Lucia", "Saint Lucia"), ("Antigua", "Antigua and Barb."), ("British Virgin Islands", "British Virgin Is."),
                   ("Jamaica", "Jamaica"), ("Barbados", "Barbados"), ("Grenada", "Grenada"), ("St. Vincent & the Grenadines", "St. Vin. and Gren."),
                   ("Dominican Republic", "Dominican Rep."), ("Anguilla", "Anguilla")]),
    "oceania": dict(name="Oceania", bbox=[110.0, -48.5, 230.0, 2.0], home=OCEANIA, z=4, wrap=True,
        hero=("GettyImages-1262623930", "A sailing catamaran anchored over a turquoise lagoon"),
        countries=[("French Polynesia", "Fr. Polynesia"), ("Australia", "Australia"), ("New Zealand", "New Zealand"), ("Fiji", "Fiji"),
                   ("Cook Islands", "Cook Is."), ("Vanuatu", "Vanuatu"), ("New Caledonia", "New Caledonia"), ("Samoa", "Samoa"),
                   ("Tonga", "Tonga"), ("Papua New Guinea", "Papua New Guinea"), ("Solomon Islands", "Solomon Is."), ("Palau", "Palau")]),
    "south-america": dict(name="South America", bbox=[-92.5, -56.5, -33.0, 13.5], home=SOUTH, z=4,
        hero=("GettyImages-1410796651", "Two travellers looking over the terraces of a mountain citadel in the Andes"),
        countries=[("Ecuador & Galápagos", "Ecuador"), ("Peru", "Peru"), ("Chile", "Chile"), ("Argentina", "Argentina"), ("Brazil", "Brazil"),
                   ("Colombia", "Colombia"), ("Bolivia", "Bolivia"), ("Uruguay", "Uruguay"), ("Falkland Islands", "Falkland Is.")]),
    "europe": dict(name="Europe", bbox=[-25.0, 34.0, 45.0, 71.5], home=EUROPE, z=4,
        hero=("GettyImages-699088407", "An ibex on a ridge facing snow-covered alpine peaks"),
        countries=[("Italy", "Italy"), ("France", "France"), ("Spain", "Spain"), ("Portugal", "Portugal"), ("Greece", "Greece"),
                   ("United Kingdom", "United Kingdom"), ("Ireland", "Ireland"), ("Switzerland", "Switzerland"), ("Austria", "Austria"),
                   ("Croatia", "Croatia"), ("Norway", "Norway"), ("Iceland", "Iceland"), ("Turkey", "Turkey")]),
    "antarctica": dict(name="Antarctica", bbox=[-75.0, -72.0, -33.0, -50.0], home=["Antarctica", "Falkland Is.", "S. Geo. and the Is."], z=5,
        hero=("GettyImages-567085269", "Snow-covered peaks and glaciers under a clearing sky"),
        countries=[("Antarctic Peninsula", "Antarctica"), ("Falkland Islands", "Falkland Is."), ("South Georgia", "S. Geo. and the Is.")]),
    "arctic": dict(name="Arctic", bbox=[-75.0, 58.0, 40.0, 81.5], home=["Greenland", "Iceland", "Norway", "Faeroe Is."], z=4,
        hero=("GettyImages-457528995", "A kayaker paddling beneath an arch of blue glacier ice"),
        countries=[("Greenland", "Greenland"), ("Iceland", "Iceland"), ("Svalbard & Arctic Norway", "Norway"), ("Faroe Islands", "Faeroe Is.")]),
}
