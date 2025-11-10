# TAMPER_EXISTING_SCRIPTS_IN_PAGE
This allows to change exisitng scripts in page thus demoing dynamic real time attacks



Start server:
bash


1
node server_for_c2.js

Open http://localhost:3000/working_c2_browser_pixel.html


Click the button → you’ll see:
5 + 5 = 10
Inject tamper script:
bash


1
2
jq -n --rawfile code tamper_add_function.js '{code: $code}' | \
  curl -X POST http://localhost:3000/execute -H "Content-Type: application/json" -d @-

  
Click the button again → now you’ll see:
5 + 5 = 110


Traffic Prism sees:
Function tampering (redefinition of window.add)
Beacon to /exfil


Behavioral shift in app logic → perfect for demo!







