import { SiteFooter, SiteHeader } from "@/components/layout";

export const metadata = { title: "Consistent hashing, explained · stickynotes sample" };

// A real page to try the extension on: an h1 the topic matcher files as
// "Consistent hashing", and h2 sections it uses as headings.
export default function Sample() {
  return (
    <>
      <SiteHeader />
      <main className="sample">
        <aside className="sample-coach">
          Select any sentence below, then click <strong>Save note</strong> or press <kbd>Alt</kbd> + <kbd>S</kbd>.
          Reload the page and your highlights come back.
        </aside>
        <article className="sample-article">
          <div className="kicker">Sample article · Distributed systems</div>
          <h1>Consistent hashing, explained</h1>
          <p>
            When a cache or a database is spread over many machines, every key needs a home. The obvious rule is to hash the
            key and take the remainder after dividing by the number of machines. It works until the number of machines changes.
          </p>

          <h2>The trouble with remainders</h2>
          <p>
            Add a fifth server to a cluster of four and the divisor changes from four to five. Almost every key now lands on a
            different server, so nearly the whole cache misses at once and the database behind it takes the full load.
          </p>
          <p>
            What we want instead is a rule where adding or removing one machine moves only the keys that machine should own,
            about one key in n, and leaves the rest where they were.
          </p>

          <h2>The ring</h2>
          <p>
            Consistent hashing maps both machines and keys onto the same circle of hash values. A key belongs to the first
            machine found by walking clockwise from the key&apos;s position.
          </p>
          <p>
            When a machine joins, it takes over only the arc between itself and the machine before it. When one leaves, its
            arc passes to the next machine along. Every other key stays put.
          </p>

          <h2>Virtual nodes</h2>
          <p>
            With only a few machines on the ring, the arcs come out uneven and one machine can end up owning far more than its
            share. The fix is to place each machine on the ring many times, as virtual nodes, so the arcs average out.
          </p>
          <p>
            Virtual nodes also make weighting simple: a machine with twice the memory gets twice as many points on the ring.
          </p>

          <h2>Where it is used</h2>
          <p>
            Distributed caches, peer-to-peer networks and partitioned databases such as Dynamo and Cassandra all place data
            this way. Load balancers use it too, to keep a returning client on the same backend.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
