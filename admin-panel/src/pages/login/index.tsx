import * as React from "react";
import { useLogin } from "@refinedev/core";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { BRAND_ASSETS, DEFAULT_COUNTRY } from "../../config/appConfig";
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, normalizeLanguageCode } from "../../config/languages";

type LoginPayload = {
  username: string;   // admin username (alphanumeric, ., _, -)
  password: string;
  country: string;    // e.g., "IN"
};

export const Login: React.FC = () => {
  const { mutate: login } = useLogin<LoginPayload>();
  const { t, i18n } = useTranslation();

  React.useEffect(() => {
    document.title = `${t("app.title")} Admin Panel`;
  }, [t]);

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [country, setCountry] = React.useState(DEFAULT_COUNTRY);
  const [language, setLanguage] = React.useState(() => normalizeLanguageCode(i18n.language));
  const [usernameError, setUsernameError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
console.log("logo src code:", BRAND_ASSETS.logo);

  // visible status + debug state
  const [status, setStatus] = React.useState("");
  const [debugOpen, setDebugOpen] = React.useState(true);
  const [lastEvent, setLastEvent] = React.useState<string>("");
  const [lastUrl, setLastUrl] = React.useState<string>("");
  const [lastResponse, setLastResponse] = React.useState<any>(null);

  const countries = [
    { code: "IN", name: "India" },
    { code: "AE", name: "UAE" },
    { code: "US", name: "United States" },
  ];

  const validateUsername = (value: string) => {
    const cleaned = (value || "").trim().toLowerCase();
    const pattern = /^[a-z0-9._-]{3,64}$/;
    if (!cleaned) return t("login.username.required");
    if (!pattern.test(cleaned)) return t("login.username.invalid");
    return null;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const err = validateUsername(username);
    setUsernameError(err);
    if (err) return;

    const cleaned = username.trim().toLowerCase();
    setSubmitting(true);
    setStatus(t("login.status_default"));
    setLastEvent("login_submit");
    setLastResponse(null);

    // we’ll capture messages coming back from authProvider
    // login(
    //   { username: cleaned, password, country },
    //   {
    //     onSuccess: (res: any) => {
    //       setStatus("Login successful.");
    //       setLastEvent("login_onSuccess");
    //       // some refine builds pass { redirectTo } here; keep a breadcrumb
    //       console.info({ event: "login_onSuccess", res });
    //     },
    //     onError: (err: any) => {
    //       const msg = err?.message || "Login failed";
    //       setStatus(msg);
    //       setLastEvent("login_onError");
    //       setLastResponse(err?.meta?.response ?? err);
    //       console.error({ event: "login_onError", err });
    //     },
    //     onSettled: () => setSubmitting(false),
    //   },
    // );

login(
  { username: cleaned, password, country },
  {
    onSuccess: (res: any) => {
      // IMPORTANT: refine's onSuccess fires when the mutation resolves,
      // but auth result may still be success:false. Check it.
      if (res?.success) {
        setStatus(t("login.status_success"));
        setLastEvent("login_onSuccess");
        setLastUrl((window as any).__cd_last_login_url || "");
        setLastResponse(null);
      } else {
        const msg = res?.error?.message || t("login.status_failure");
        setStatus(msg);
        setLastEvent("login_onError");
        setLastUrl(res?.error?.meta?.url || (window as any).__cd_last_login_url || "");
        setLastResponse(res?.error?.meta?.response || res?.error);
      }
    },
    onError: (err: any) => {
      const msg = err?.message || t("login.status_failure");
      setStatus(msg);
      setLastEvent("login_onError");
      setLastUrl(err?.meta?.url || (window as any).__cd_last_login_url || "");
      setLastResponse(err?.meta?.response || err);
    },
    onSettled: () => setSubmitting(false),
  }
);


  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: { xs: 1.5, sm: 2 } }}>
      <Card
        sx={{
          width: { xs: "100%", sm: 420 },
          maxWidth: 480,
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          borderRadius: 2,
        }}
      >
        <CardContent>
          <Stack component="form" onSubmit={onSubmit} spacing={2}>
            <Stack alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Box
                component="img"
                src={BRAND_ASSETS.logo}

                alt="CiberMandi"
                sx={{
                  height: "auto",
                  width: "100%",
                  maxWidth: 160,
                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))",
                }}
              />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t("app.title")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("app.tagline")}
              </Typography>
            </Stack>

            <Typography variant="h5" sx={{ mb: 1, textAlign: "center" }}>
              {t("login.heading")}
            </Typography>

            <FormControl fullWidth>
              <InputLabel id="language-label">{t("login.language")}</InputLabel>
              <Select
                labelId="language-label"
                value={language}
                label={t("login.language")}
                onChange={(e) => {
                  const next = e.target.value as string;
                  setLanguage(next);
                  i18n.changeLanguage(next);
                  try {
                    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.nativeLabel} ({lang.label})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t("login.username.label")}
              type="text"
              placeholder={t("login.username.placeholder")}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError(null);
              }}
              inputProps={{ maxLength: 64 }}
              error={!!usernameError}
              helperText={usernameError || " "}
              fullWidth
              required
            />

            <TextField
              label={t("login.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />

            <FormControl fullWidth>
              <InputLabel id="country-label">{t("login.country")}</InputLabel>
              <Select
                labelId="country-label"
                value={country}
                label={t("login.country")}
                onChange={(e) => setCountry((e.target.value as string) || DEFAULT_COUNTRY)}
              >
                {countries.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {t("login.submit")}
            </Button>

            {/* status line */}
            {status ? (
              <Typography variant="body2" color="text.secondary">
                {status}
              </Typography>
            ) : null}

            {/* debug box */}
            <Box
              sx={{
                mt: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: "#f7f7f7",
                border: "1px solid #e0e0e0",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Debug
                </Typography>
                <Button size="small" onClick={() => setDebugOpen((v) => !v)}>
                  {debugOpen ? "Hide" : "Show"}
                </Button>
              </Box>
              {debugOpen && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption">event: {lastEvent || "-"}</Typography>
                  {lastUrl ? (
                    <Typography variant="caption" sx={{ display: "block" }}>
                      url: {lastUrl}
                    </Typography>
                  ) : null}
                  {lastResponse ? (
                    <Box sx={{ mt: 1, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap" }}>
                      <Typography variant="caption">
                        {JSON.stringify(lastResponse, null, 2)}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ display: "block", opacity: 0.7 }}>
                      (No API response captured yet)
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};


// import * as React from "react";
// import { useLogin } from "@refinedev/core";
// import {
//   Box,
//   Card,
//   CardContent,
//   TextField,
//   Button,
//   Typography,
//   Stack,
//   FormControl,
//   InputLabel,
//   Select,
//   MenuItem,
// } from "@mui/material";
// import { useTranslation } from "react-i18next";

// type LoginPayload = {
//   username: string;   // 10-digit mobile (6–9 start)
//   password: string;
//   country: string;    // e.g., "IN"
// };

// export const Login: React.FC = () => {
//   const { mutate: login } = useLogin<LoginPayload>();
//   const { t } = useTranslation();

//   const [mobile, setMobile] = React.useState("");
//   const [password, setPassword] = React.useState("");
//   const [country, setCountry] = React.useState("IN");
//   const [mobileError, setMobileError] = React.useState<string | null>(null);
//   const [submitting, setSubmitting] = React.useState(false);
//   const [status, setStatus] = React.useState<string>("");

//   const countries = [
//     { code: "IN", name: "India" },
//     { code: "AE", name: "UAE" },
//     { code: "US", name: "United States" },
//   ];

//   const validateMobile = (value: string) => {
//     const cleaned = value.replace(/\D/g, "");
//     const pattern = /^[6-9]\d{9}$/;
//     if (!cleaned) return t("auth.mobile_required") || "Mobile number is required";
//     if (!pattern.test(cleaned))
//       return (
//         t("auth.mobile_invalid") ||
//         "Enter a valid 10-digit mobile number (starts with 6-9)"
//       );
//     return null;
//   };

//   const onSubmit = (e: React.FormEvent) => {
//     e.preventDefault();

//     const err = validateMobile(mobile);
//     setMobileError(err);
//     if (err) return;

//     const cleaned = mobile.replace(/\D/g, "");
//     setSubmitting(true);
//     setStatus("Signing in…");

//     // 🔍 log what we're attempting (no secrets)
//     console.info({
//       event: "login_submit",
//       payloadPreview: { username: cleaned, country },
//     });

// login(
//   { username: cleaned, password, country },
//   {
//     onSuccess: () => {
//       console.info({ event: "login_onSuccess" });
//       // Refine will navigate automatically on success because authProvider returns success:true
//     },
//     onError: (err: any) => {
//       const msg = err?.message || "Login failed";
//       console.error({ event: "login_onError", msg, err });
//       // show under the button (you already have setStatus in your version)
//       // setStatus(msg);
//       alert(msg); // simple and visible
//     },
//     onSettled: () => setSubmitting(false),
//   }
// );


//   };

//   return (
//     <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
//       <Typography sx={{ position: "absolute", top: 8, left: 8 }} variant="caption">
//         CD Custom Login
//       </Typography>

//       <Card sx={{ width: 380, maxWidth: "100%" }}>
//         <CardContent>
//           <Stack component="form" onSubmit={onSubmit} spacing={2}>
//             <Typography variant="h5" sx={{ mb: 1, textAlign: "center" }}>
//               {t("auth.sign_in") || "Sign in"}
//             </Typography>

//             {/* Mobile */}
//             <TextField
//               label={t("auth.mobile_label") || "Mobile number"}
//               type="tel"
//               placeholder={t("auth.mobile_placeholder") || "Enter 10-digit mobile number"}
//               value={mobile}
//               onChange={(e) => {
//                 const digits = e.target.value.replace(/\D/g, "");
//                 setMobile(digits.slice(0, 10));
//                 if (mobileError) setMobileError(null);
//               }}
//               inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
//               error={!!mobileError}
//               helperText={mobileError || " "}
//               fullWidth
//               required
//             />

//             {/* Password */}
//             <TextField
//               label={t("auth.password") || "Password"}
//               type="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               fullWidth
//               required
//             />

//             {/* Country (moved below password as requested) */}
//             <FormControl fullWidth>
//               <InputLabel id="country-label">Country</InputLabel>
//               <Select
//                 labelId="country-label"
//                 value={country}
//                 label="Country"
//                 onChange={(e) => setCountry((e.target.value as string) || "IN")}
//               >
//                 {countries.map((c) => (
//                   <MenuItem key={c.code} value={c.code}>
//                     {c.name}
//                   </MenuItem>
//                 ))}
//               </Select>
//             </FormControl>

//             <Button type="submit" variant="contained" size="large" disabled={submitting}>
//               {t("auth.sign_in") || "Sign in"}
//             </Button>

//             {/* simple on-screen status */}
//             {status ? (
//               <Typography variant="caption" color="text.secondary">
//                 {status}
//               </Typography>
//             ) : null}
//           </Stack>
//         </CardContent>
//       </Card>
//     </Box>
//   );
// };
