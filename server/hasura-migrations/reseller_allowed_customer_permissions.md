# Hasura permissions for reseller_allowed_customer

Apply these in **Hasura Console** (Data → reseller_allowed_customer → Permissions) for the **reseller** role.

- **select**: Row permission `reseller_id` = `X-Hasura-Reseller-Id` (or your JWT claim for reseller id).
- **insert**: Row permission allow insert; set `reseller_id` from session variable (e.g. preset column `reseller_id` = session variable).
- **update**: Row permission `reseller_id` = session variable.
- **delete**: Row permission `reseller_id` = session variable.

If the frontend uses admin secret and passes `reseller_id` in variables, ensure the **admin** role has select/insert/update/delete on this table (or use a role that does). The reseller UI only sends the logged-in reseller’s id.
