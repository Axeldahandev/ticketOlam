import mongoose from "mongoose";

const StepSchema = new mongoose.Schema({
  step_id: { type: Number, required: true },
  step_name: { type: String, required: true },
  step_description: { type: String, required: true },
  status: { type: Boolean, default: false },
}, { _id: false });

const VenueSchema = new mongoose.Schema({
  name: String,
  city: String,
  country: String,
  postal_code: String,
}, { _id: false });

const ClassificationsSchema = new mongoose.Schema({
  segment: String,
  genre: String,
  subgenre: String,
}, { _id: false });

const EventSchema = new mongoose.Schema({
  ticketmaster_id: { type: String, unique: true, index: true, required: true },
  name: { type: String, required: true },
  local_date: { type: String, required: true },
  local_time: { type: String },
  venue: { type: VenueSchema, required: true },
  classifications: { type: ClassificationsSchema, required: true },
  steps: { type: [StepSchema], default: [] },
  original_ticketmaster_api_url: { type: String },
  website_url: { type: String },
  tickets_url: { type: String },
  tickets: { type: Array, default: [] },
  viagogo_listings: { type: Array, default: [] },
  viagogo_blocks: { type: Array, default: [] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Pour que les dates soient bien auto-mises à jour
EventSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const Event = mongoose.model("Event", EventSchema);

export default Event;
