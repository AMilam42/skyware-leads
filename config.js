// ---- Settings you may want to change ----
window.SKY_CONFIG = {
  defaultEvent: "Trade Show 2026",   // Starting event name; staff change it per show on the Staff screen.
  resetSeconds: 8,                   // Thank-you screen time before the form clears

  // Staff logins for the Staff screen. Passwords are stored as fingerprints, not plain text.
  // To add or change one, run:  node make-login.js <username> <password>  and paste the line it prints here.
  staffLogins: [
    { username: "staff", passwordHash: "9e34c966e6fe0b1330d534821f8f58e9d9b9a1163341ed6d02aa505161bc296e" },   // temporary: staff / skyware. Replace before the show.
  ],

  // Brands staff can pick on the Staff screen. Each iPad remembers its choice.
  brands: {
    hotel: {
      name: "Payments",
      blurb: "Hotels, resorts and payments",
      logo: "logo.png",
      alt: "Skyware Hospitality Solutions, powered by 1Step",
      headline: "Let's talk about your property",
      propertyPlaceholder: "Hotel or resort name",
      footer: "877-759-9329 &middot; sales@skywaresystems.com &middot; skywaresystems.com",
    },
    rv: {
      name: "RV Solutions",
      blurb: "RV parks and campgrounds",
      logo: "logo-rv.png",
      alt: "Skyware RV Solutions",
      headline: "Let's talk about your park",
      propertyPlaceholder: "RV park or campground name",
      footer: "877-759-9329 &middot; sales@skywaresystems.com &middot; skywaresystems.com",
    },
  },

  // Form fields. Add, remove or reorder; the form, validation and Excel columns follow.
  // type: text | email | phone
  fields: [
    { key: "name",          label: "Name",          type: "text",  required: true, placeholder: "Your full name" },
    { key: "property_name", label: "Property Name", type: "text",  required: true, placeholder: "Hotel or resort name" },
    { key: "phone",         label: "Phone Number",  type: "phone", required: true, placeholder: "(555) 555-5555" },
    { key: "email",         label: "Email",         type: "email", required: true, placeholder: "you@property.com" },
  ],
};
