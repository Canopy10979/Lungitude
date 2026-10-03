Put NCI State Cancer Profiles county exports for Washington here, one file per cancer.
Use exactly these file names:

    lung.csv  breast.csv  colorectal.csv  prostate.csv  bladder.csv  kidney.csv
    melanoma.csv  leukemia.csv  nhl.csv  pancreas.csv  liver.csv

How to export one file:
    1. Go to statecancerprofiles.cancer.gov -> Incidence Rates Table.
    2. Area: Washington, by County. Cancer: (one from the list). Race: All. Sex: Both
       (Female for breast, Male for prostate). Age: All Ages. Stage: All Stages.
    3. Click "Export" and save the CSV here with the name above.

Then run:   php tools/import_scp.php
It writes data/wa_county_rates.json, which the survey uses.
