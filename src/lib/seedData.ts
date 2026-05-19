import { getDefaultArenaStructure } from "./arenaLayout";

const toDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
};

export const activityImages = {
  hero: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=90",
  kalari: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1600&q=88",
  boat: "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=1600&q=88",
  temple: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=1600&q=88",
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=88",
  spice: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1600&q=88",
  ayurveda: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1600&q=88",
  city: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=88",
};

export const getSeedData = () => {
  const layout = {
    id: "layout-main-arena",
    name: "Main Kalari Arena",
    structure: getDefaultArenaStructure(),
    created_at: new Date().toISOString(),
  };

  const activities = [
    {
      id: "activity-kalari-evening-show",
      slug: "kalari-evening-show",
      title: "Kalaripayattu Evening Fire Show",
      category: "Kalari Booking",
      location: "Kovalam Kalari Arena",
      duration: "1.5 hours",
      price: 799,
      rating: 4.9,
      review_count: 428,
      image: activityImages.kalari,
      description: "A reserved-seat live Kalaripayattu performance with weapons, fire movements, and traditional percussion.",
      highlights: ["Reserved arena seating", "Weapon and fire demonstrations", "Photo time after the show"],
      included: ["Entry ticket", "Host assistance", "Digital confirmation"],
      tags: ["Likely to sell out", "Family friendly", "Instant confirmation"],
      status: "ACTIVE",
      featured: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "activity-private-kalari-workshop",
      slug: "private-kalari-workshop",
      title: "Private Kalari Basics Workshop",
      category: "Activities",
      location: "Kovalam Training Hall",
      duration: "2 hours",
      price: 2499,
      rating: 4.8,
      review_count: 116,
      image: activityImages.temple,
      description: "A guided beginner workshop covering stance, movement, breath, and the cultural roots of Kalaripayattu.",
      highlights: ["Small-group instruction", "Beginner friendly", "Traditional warm-up sequence"],
      included: ["Instructor", "Practice space", "Water"],
      tags: ["Private option", "Beginner friendly"],
      status: "ACTIVE",
      featured: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "activity-backwater-day",
      slug: "kerala-backwater-day",
      title: "Kerala Backwater Day Escape",
      category: "Activities",
      location: "Poovar Backwaters",
      duration: "5 hours",
      price: 1899,
      rating: 4.7,
      review_count: 304,
      image: activityImages.boat,
      description: "Cruise through quiet backwaters, coconut groves, and village canals before returning to Kovalam.",
      highlights: ["Backwater cruise", "Village waterways", "Hotel pickup option"],
      included: ["Boat ride", "Local guide", "Refreshments"],
      tags: ["Top activity", "Outdoor"],
      status: "ACTIVE",
      featured: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "activity-ayurveda-reset",
      slug: "ayurveda-reset",
      title: "Ayurveda Reset Session",
      category: "Activities",
      location: "Kovalam Wellness Studio",
      duration: "90 minutes",
      price: 1599,
      rating: 4.6,
      review_count: 91,
      image: activityImages.ayurveda,
      description: "A calm wellness session with consultation, herbal oil therapy, and recovery time.",
      highlights: ["Personal consultation", "Herbal oils", "Quiet recovery lounge"],
      included: ["Therapist", "Oils", "Tea"],
      tags: ["Wellness", "Relaxing"],
      status: "ACTIVE",
      featured: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "activity-spice-market-walk",
      slug: "trivandrum-spice-market-walk",
      title: "Trivandrum Spice Market Walk",
      category: "Activities",
      location: "Thiruvananthapuram",
      duration: "3 hours",
      price: 999,
      rating: 4.5,
      review_count: 73,
      image: activityImages.spice,
      description: "Explore spice lanes, temple streets, and snack stops with a local host.",
      highlights: ["Market tastings", "Local host", "Old city lanes"],
      included: ["Guide", "Tastings", "Transit between stops"],
      tags: ["Food", "Walking tour"],
      status: "ACTIVE",
      featured: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const shows = [];
  
  // Generate daily evening shows for the next 14 days
  for (let i = 0; i < 14; i++) {
    shows.push({
      id: `show-kalari-evening-${i}`,
      activity_id: "activity-kalari-evening-show",
      title: "Kalaripayattu Evening Fire Show",
      date: toDate(i),
      time: "18:30",
      price: 799,
      image: activityImages.kalari,
      description: "The signature evening performance with weapon routines and fire choreography.",
      type: "KALARI",
      capacity: 120,
      layout_id: layout.id,
      active: true,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    });

    // Add a second show on weekends (Friday, Saturday, Sunday)
    const date = new Date();
    date.setDate(date.getDate() + i);
    const day = date.getDay();
    if (day === 0 || day === 5 || day === 6) {
      shows.push({
        id: `show-kalari-night-${i}`,
        activity_id: "activity-kalari-evening-show",
        title: "Kalaripayattu Premium Night Show",
        date: toDate(i),
        time: "20:30",
        price: 999,
        image: activityImages.kalari,
        description: "Premium night performance with front-row availability and host welcome.",
        type: "KALARI",
        capacity: 120,
        layout_id: layout.id,
        active: true,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      });
    }

    // Add workshops every 2 days
    if (i % 2 === 0) {
      shows.push({
        id: `show-kalari-workshop-${i}`,
        activity_id: "activity-private-kalari-workshop",
        title: "Private Kalari Basics Workshop",
        date: toDate(i),
        time: "10:00",
        price: 2499,
        image: activityImages.temple,
        description: "A guided hands-on workshop for travellers and small groups.",
        type: "EVENT",
        capacity: 18,
        layout_id: null,
        active: true,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      });
    }

    // Add Backwater trips on Tuesdays and Thursdays
    if (day === 2 || day === 4) {
      shows.push({
        id: `show-backwater-${i}`,
        activity_id: "activity-backwater-day",
        title: "Kerala Backwater Day Escape",
        date: toDate(i),
        time: "09:00",
        price: 1899,
        image: activityImages.boat,
        description: "Cruise through quiet backwaters, coconut groves, and village canals.",
        type: "EVENT",
        capacity: 12,
        layout_id: null,
        active: true,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      });
    }

    // Add Ayurveda sessions on Wednesdays and Mondays
    if (day === 1 || day === 3) {
      shows.push({
        id: `show-ayurveda-${i}`,
        activity_id: "activity-ayurveda-reset",
        title: "Ayurveda Reset Session",
        date: toDate(i),
        time: "11:00",
        price: 1599,
        image: activityImages.ayurveda,
        description: "A calm wellness session with consultation and herbal oil therapy.",
        type: "EVENT",
        capacity: 4,
        layout_id: null,
        active: true,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      });
    }
  }

  // Add some specific upcoming events
  shows.push({
    id: "show-cultural-festival",
    activity_id: "activity-kalari-evening-show",
    title: "Grand Kalari Cultural Festival",
    date: toDate(7),
    time: "17:00",
    price: 1499,
    image: activityImages.kalari,
    description: "A special 3-hour festival featuring masters from across Kerala.",
    type: "KALARI",
    capacity: 120,
    layout_id: layout.id,
    active: true,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
  });

  return { activities, shows, layouts: [layout] };
};

