import React from "react";
import { Link } from "react-router-dom";
import "./AboutPage.css";

const milestones = [
  {
    year: "2015",
    title: "Humble beginnings",
    copy: "We opened our first counter with a handful of power tools and a promise to bring reliable hardware to local builders.",
  },
  {
    year: "2018",
    title: "Supplier partnerships",
    copy: "Expanded into smart hardware through close collaborations with leading manufacturers across Asia and Europe.",
  },
  {
    year: "2021",
    title: "Service-first evolution",
    copy: "Launched on-site support, custom sourcing, and repair concierge to help pros keep every project on track.",
  },
  {
    year: "2024",
    title: "Connected supply chain",
    copy: "Rolled out our digital storefront and inventory automation, giving teams real-time visibility from quote to delivery.",
  },
];

const coreValues = [
  {
    icon: "🛠️",
    title: "Craftsmanship",
    copy: "We stand behind every product we stock. If it isn't workshop-worthy, it doesn't make the shelf.",
  },
  {
    icon: "🤝",
    title: "Partnership",
    copy: "From the weekend tinkerer to national contractors, we stay in the trenches until the job is done.",
  },
  {
    icon: "⚡",
    title: "Responsiveness",
    copy: "Fast quotes, faster deliveries, and proactive alerts keep your crew focused on the build—never the backlog.",
  },
];

export default function AboutPage() {
  return (
    <main className="about">
      <section className="about__hero">
        <p className="eyebrow">Who we are</p>
        <h1>Powering every build with smarter hardware</h1>
        <p className="lead">
          HardTech blends trusted tooling with connected logistics so your projects never miss a beat. We combine
          decades of retail experience with a forward-looking inventory platform crafted for contractors, suppliers,
          and facilities teams across Sri Lanka.
        </p>
        <div className="hero-actions">
          <Link to="/customer-products" className="btn btn-primary">
            Explore catalogue
          </Link>
          <a href="#values" className="btn btn-outline">
            Our values
          </a>
        </div>
      </section>

      <section className="about__grid" aria-labelledby="about-values" id="values">
        <div className="about__grid-copy">
          <h2 id="about-values">Built around your site, not our shelves</h2>
          <p>
            Whether you are scaling a residential development or maintaining a factory floor, we keep stock moving
            and teams aligned. Our blended inventory model unifies supplier feeds, warehouse levels, and custom orders
            into a single source of truth so you get what you need—exactly when you need it.
          </p>
        </div>
        <ul className="about__values">
          {coreValues.map((value) => (
            <li key={value.title}>
              <span className="value-icon" aria-hidden="true">{value.icon}</span>
              <h3>{value.title}</h3>
              <p>{value.copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="about__timeline" aria-labelledby="about-story">
        <h2 id="about-story">A timeline of getting things done</h2>
        <ol>
          {milestones.map((item) => (
            <li key={item.year}>
              <div className="timeline-year">{item.year}</div>
              <div className="timeline-card">
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="about__cta" aria-labelledby="cta-heading">
        <div className="cta-card">
          <div>
            <p className="eyebrow">Ready to partner?</p>
            <h2 id="cta-heading">Let’s kit out your next project</h2>
            <p>
              Our specialists are on call to source custom hardware, plan recurring shipments, and tailor the HardTech
              platform for your operations team.
            </p>
          </div>
          <div className="cta-actions">
            <Link to="/register" className="btn btn-primary">
              Create customer account
            </Link>
            <Link to="/register-supplier" className="btn btn-secondary">
              Join as supplier
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
