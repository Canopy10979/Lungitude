# Google Maps skin-care search

The active skin page now shows a location-consented search for “skin cancer centers”, with results inside Lungitude and an Open in Google Maps button for each listing. This replaces the generic dermatologist-directory redirect. It does not navigate to local research pages or claim that a listing provides verified cancer treatment.

The Python account service loads the ignored repository .env; GOOGLE_PLACES_KEY holds the server-only API key. The key is never committed, returned to the browser, or included in query strings. This is separate from GOOGLE_WEB_CLIENT_ID used for sign-in. On Windows:

```powershell
cd C:\Users\rishi\Downloads\Lungitude-Training
powershell -ExecutionPolicy Bypass -File .\scripts\Set-GoogleMapsKey.ps1
```

Paste the supplied Google Maps key at the hidden prompt. This updates only its entry in .env and preserves other entries. Stop the existing Python service with Ctrl+C and restart start-imaging.bat. Keep PHP running from the same folder. Hard refresh localhost:8000. Choose Find skin cancer care within 1 mile and allow location access. iPhone geolocation/camera requires a reachable HTTPS site; localhost on the phone is not the laptop.

## Google Cloud blocker observed

A configuration probe using a public Redmond city-center coordinate (not the user's device location), on October 24, 2026, returned HTTP 403, PERMISSION_DENIED, reason SERVICE_DISABLED from Places API (New). Enable https://console.cloud.google.com/apis/library/places.googleapis.com in the project that owns the key. Configure Maps billing if required and use server-compatible key restrictions. HTTP referrer restrictions intended for browser JavaScript do not authenticate a server-side Places call. Set a suitable quota in Google Cloud. The local prototype also limits calls to 20/hour per backend client address; with the local PHP proxy, that limit is shared by local visitors. No broader paid searches are performed automatically.

The feature uses POST /v1/places:searchText, a fixed query, distance ranking and a circular location bias. Because a bias is not a hard boundary, every returned coordinate is independently filtered with haversine distance <=1609.344 meters, deduplicated and ordered by distance; at most 10 matches are displayed from the returned page. No silent radius expansion or invented fallback listings. Empty results do not prove no providers exist: Google relevance, indexing and page limits affect coverage. Distance is straight-line and location accuracy affects it.

No images, analysis scores or saved health profile are sent to Google for this search. Device location is requested only after an explicit click, not on app load. Clear cancels the pending request and discards displayed listings; late responses cannot repopulate the list. Places results are not stored/cached locally. Google Maps attribution and returned provider attributions are displayed with the results. Google's terms/privacy links are shown. Actual treatment offerings must be confirmed directly with the clinic.

Validation: API tests cover consent, malformed coordinates, strict one-mile filtering despite the location bias, deduplication, distance ordering and missing-key refusal. Frontend tests use mocked location/Maps responses and cover user-click location access, denied permission and stale-result clearing. A successful real listing search remains blocked by SERVICE_DISABLED until the owner enables Places API (New). Windows/iPhone execution remains unverified.

Primary references:
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText
- https://developers.google.com/maps/documentation/urls/get-started
- https://developers.google.com/maps/documentation/places/web-service/policies
