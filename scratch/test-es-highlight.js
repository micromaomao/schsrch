const es = require('elasticsearch');
const client = new es.Client({ host: '127.0.0.1:9200' });

client.search({
  index: 'pastpaper',
  body: {
    query: {
      match: {
        content: 'concentration'
      }
    },
    highlight: {
      fields: {
        content: {
          fragment_size: 150,
          number_of_fragments: 3,
          pre_tags: ['<mark>'],
          post_tags: ['</mark>']
        }
      }
    }
  }
}).then(res => {
  console.log(JSON.stringify(res.hits.hits[0].highlight, null, 2));
  console.log(res.hits.hits[0]._source.page);
}).catch(console.error);
