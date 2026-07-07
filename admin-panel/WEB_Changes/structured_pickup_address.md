# Direct Trade Structured Pickup Address

## Web Admin Changes

- Direct Trade approval detail now displays Farmer Entered Address separately from GPS Verified Address.
- Farmer entered address is rendered from `address_line_1`, `address_line_2`, `locality`/`village`, `district`, `state`, and `pincode`.
- GPS verified address is rendered from nested `pickup.gps` first, with legacy fallback fields.
- Admin/reviewer detail view may show GPS coordinates.
- Public marketplace GPS coordinate hiding is handled in the API trader listing response.

## Before Pickup JSON

```json
{
  "address_line": "Farm near main road",
  "district": "Ghaziabad",
  "state": "Uttar Pradesh",
  "pincode": "201012",
  "gps_address": "Farm area, Ghaziabad, Uttar Pradesh 201012",
  "gps_pincode": "201012"
}
```

## After Pickup JSON

```json
{
  "address_line_1": "Farm near main road",
  "address_line_2": "Behind mandi gate",
  "locality": "Kavi Nagar",
  "district": "Ghaziabad",
  "state": "Uttar Pradesh",
  "pincode": "201012",
  "gps": {
    "address": "Farm area, Ghaziabad, Uttar Pradesh 201012",
    "district": "Ghaziabad",
    "state": "Uttar Pradesh",
    "pincode": "201012",
    "lat": 28.66,
    "lng": 77.45
  }
}
```

## Mongo

- Exact collection touched by backend script: `cibermandi_market_IN.direct_trade_listings`.
- Mongo script must be run once per environment after deployment.
- Safe to rerun: yes.

## Regression Checklist

- Open Direct Trade approval detail for a new structured listing.
- Open Direct Trade approval detail for an old listing with only `address_line`.
- Confirm Farmer Entered Address and GPS Verified Address render separately.
- Confirm GPS coordinates are visible only in admin/reviewer context.
