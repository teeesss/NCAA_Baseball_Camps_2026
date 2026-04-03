const fs = require('fs');

const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
const verified = JSON.parse(fs.readFileSync('verified/arkansas.json', 'utf8'));

const contactStr = "Dave Van Horn | dvanhorn@uark.edu";

const ark = data.find(d => d.university === 'Arkansas');
if (ark) {
    ark.contact = contactStr;
    fs.writeFileSync('camps_data.json', JSON.stringify(data, null, 2));
    
    verified.contact = ark.contact;
    fs.writeFileSync('verified/arkansas.json', JSON.stringify(verified, null, 2));
    
    console.log('Arkansas contact updated with coach & email.');
}
