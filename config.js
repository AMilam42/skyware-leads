// ---- Settings you may want to change ----
window.SKY_CONFIG = {
  defaultEvent: "Trade Show 2026",   // Starting event name; staff change it per show on the Staff screen.
  resetSeconds: 8,                   // Thank-you screen time before the form clears

  // Brands staff can pick on the Staff screen. Each iPad remembers its choice.
  brands: {
    hotel: {
      logo: "logo.png",
      alt: "Skyware Hospitality Solutions, powered by 1Step",
      headline: "Let's talk about your property",
      propertyPlaceholder: "Hotel or resort name",
      footer: "877-759-9329 &middot; sales@skywaresystems.com &middot; skywaresystems.com",
    },
    rv: {
      logo: "logo-rv.png",
      alt: "Skyware RV Solutions",
      headline: "Let's talk about your park",
      propertyPlaceholder: "RV park or campground name",
      footer: "",   // [CONFIRM] RV contact details; left blank until confirmed
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
