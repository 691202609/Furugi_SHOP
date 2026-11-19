# Session / Profile fix

- Customer login now persists across pages and browser tabs on the same browser/device.
- The Login Gate remains active for users with no valid Supabase session.
- `account.html` remains the customer profile page.
- The user icon (`人`) links to `account.html` after authentication.
- Logout still calls Supabase `signOut()` and returns to the login page.

After replacing the project files, deploy normally to Vercel.
