require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { GrantType, KindeClient } = require("@kinde-oss/kinde-nodejs-sdk");
const { isAuthenticated } = require("./middlewares/isAuthenticated");
const axios = require("axios").default;

const app = express();
const port = 3000;
const options = {
  domain: process.env.KINDE_DOMAIN,
  clientId: process.env.KINDE_CLIENT_ID,
  clientSecret: process.env.KINDE_CLIENT_SECRET,
  redirectUri: process.env.KINDE_REDIRECT_URI,
  postLoginRedirectUri: process.env.KINDE_POST_LOGIN_REDIRECT_URI || "",
  logoutRedirectUri: process.env.KINDE_LOGOUT_REDIRECT_URI || "",
  grantType: GrantType.PKCE
  // scope: 'openid offline profile email'
  // audience: 'https://example.com/api'
};
const kindeClient = new KindeClient(options);

app.use(express.static("public"));
app.set("view engine", "pug");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/login", kindeClient.login(), (req, res) => {
  return res.redirect("/admin");
});

app.get("/callback", kindeClient.callback(), async (req, res) => {
  return res.redirect("/admin");
});

app.get("/register", kindeClient.register(), (req, res) => {
  return res.redirect("/admin");
});

app.get("/createOrg", kindeClient.createOrg(), (req, res) => {
  return res.redirect("/admin");
});

app.get("/logout", kindeClient.logout());

app.get("/helper-functions", isAuthenticated(kindeClient), (req, res) => {
  res.render("helper_functions", {
    user: kindeClient.getUserDetails(req)
  });
});

app.get("/user-detail", isAuthenticated(kindeClient), async (req, res) => {
  const accessToken = await kindeClient.getToken(req);
  res.render("details", {
    user: kindeClient.getUserDetails(req),
    accessToken: accessToken
  });
});

app.get("/get-claim-view", isAuthenticated(kindeClient), (req, res) => {
  const result = kindeClient.getClaim(req, "given_name", "id_token");
  res.render("get_claim", {
    user: kindeClient.getUserDetails(req),
    resultGetClaim: JSON.stringify(result)
  });
});

app.get("/get-flag-view", isAuthenticated(kindeClient), (req, res) => {
  const result = kindeClient.getFlag(req, "theme", { defaultValue: false }, "s");
  res.render("get_flag", {
    user: kindeClient.getUserDetails(req),
    resultGetFlag: JSON.stringify(result)
  });
});

app.get("/get-permissions-view", isAuthenticated(kindeClient), (req, res) => {
  res.render("get_permissions", {
    user: kindeClient.getUserDetails(req),
    resultGetPermissions: JSON.stringify(kindeClient.getPermissions(req))
  });
});

app.get("/get-permission-view", isAuthenticated(kindeClient), (req, res) => {
  res.render("get_permission", {
    user: kindeClient.getUserDetails(req)
  });
});

app.post("/get-permission", isAuthenticated(kindeClient), (req, res) => {
  try {
    const { permission } = req.body;
    const result = kindeClient.getPermission(req, permission);
    if (result) {
      res.render("get_permission", { user: kindeClient.getUserDetails(req), resultGetPermission: JSON.stringify(result) });
    }
  } catch (e) {
    res.render("get_permission", { user: kindeClient.getUserDetails(req), errorGetPermission: e.message });
  }
});

app.get("/get-organization-view", isAuthenticated(kindeClient), (req, res) => {
  res.render("get_organization", {
    user: kindeClient.getUserDetails(req),
    resultGetOrganization: JSON.stringify(kindeClient.getOrganization(req))
  });
});

app.get("/get-user-organization-view", isAuthenticated(kindeClient), (req, res) => {
  res.render("get_user_organizations", {
    user: kindeClient.getUserDetails(req),
    resultGetUserOrganizations: JSON.stringify(kindeClient.getUserOrganizations(req))
  });
});

app.get("/get-organizations", isAuthenticated(kindeClient), async (req, res) => {
  var resultData = [];
  let nextToken = null;

  try {
    const token = await getM2MToken();

    do {
      const resOptions = {
        method: "GET",
        url: options.domain + "/api/v1/organizations",
        headers: {
          Authorization: "Bearer " + token
        },
        params: nextToken ? { next_token: nextToken } : {}
      };

      const { data } = await axios.request(resOptions);
      if (data.organizations) resultData = resultData.concat(data.organizations.map(org => org.code));
      nextToken = data.next_token;
    } while (nextToken);

    resultData = { orgCodes: resultData };
  } catch (error) {
    resultData = { error: "Failed to fetch organizations: " + error.message };
  }

  res.render("get_organizations", {
    user: kindeClient.getUserDetails(req),
    resultGetOrganizations: JSON.stringify(resultData)
  });
});

app.get("/get-token-view", isAuthenticated(kindeClient), async (req, res) => {
  const token = await kindeClient.getToken(req);
  res.render("get_token", {
    user: kindeClient.getUserDetails(req),
    resultGetToken: token
  });
});

app.get("/", async (req, res) => {
  const isAuthenticated = await kindeClient.isAuthenticated(req);
  if (isAuthenticated) {
    res.redirect("/admin");
  } else {
    res.render("index", {
      title: "Hey",
      message: "Hello there! what would you like to do?"
    });
  }
});

app.get("/admin", isAuthenticated(kindeClient), (req, res) => {
  res.render("admin", {
    title: "Admin",
    user: kindeClient.getUserDetails(req)
  });
});

app.listen(port, () => {
  console.log(`Kinde NodeJS Starter Kit listening on port ${port}!`);
});

async function getM2MToken() {
  try {
    const response = await fetch(`${options.domain}/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        audience: options.domain + "/api",
        grant_type: "client_credentials",
        client_id: "4bf158b8a1044809abed43425944ef87",
        client_secret: "Rt5l3grUNirHlfXMCzLJpFVzkvL1BMjfpevapyy8kuVlKCRUZ2qW"
      })
    });

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();
    return json.access_token;
  } catch (error) {
    throw new Error(`Error: ${error.message}`);
  }
}
