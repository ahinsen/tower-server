const httpListener=function(req,res){
	res.writeHead(200);
	if (req.method === 'POST') {
	    let data = '';
	    req.on('data', chunk => {
	      data += chunk.toString();
	    });
	    req.on('end', () => {
	      console.log('Headers:'+ req.headers.toString());
	      console.log('POST data:', data);
	      res.end('Received'+data.length.toString()+' bytes of data \n');
	    });
	  } else {
	    res.end('Send a POST request to this endpoint_V7');
		console.log('Received non-POST');
	  }
}

export default httpListener;