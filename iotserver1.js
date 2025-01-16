const http=require("http");
const msgListener=function(req,res){
	res.writeHead(200);
/	res.end("MyFirstServer");/
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
	    res.end('Send a POST request to this endpoint_V5');
	  }
}
const port=8000;
const host='127.0.0.1';
const server = http.createServer(msgListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
