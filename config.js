// ---- Settings you may want to change ----
window.SKY_CONFIG = {
  defaultEvent: "Trade Show 2026",   // Starting event name; staff change it per show on the Staff screen.
  resetSeconds: 8,                   // Thank-you screen time before the form clears

  // Form fields. Add, remove or reorder; the form, validation and Excel columns follow.
  // type: text | email | phone
  fields: [
    { key: "name",          label: "Name",          type: "text",  required: true, placeholder: "Your full name" },
    { key: "property_name", label: "Property Name", type: "text",  required: true, placeholder: "Hotel or resort name" },
    { key: "phone",         label: "Phone Number",  type: "phone", required: true, placeholder: "(555) 555-5555" },
    { key: "email",         label: "Email",         type: "email", required: true, placeholder: "you@property.com" },
  ],
};
