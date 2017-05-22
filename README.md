# Xirsys WebRTC Examples for V3 API

These are examples used by the Xirsys team to teach and test features of the API and WebRTC.  Feel free to use modify and improve the examples as needed.  Any public contributions, suggestions or modifications which can help anyone else is appreciated.  Please contact us at **support@xirsys.com** to submit.

### What you will need

* [Xirsys Account](http://xirsys.com/pricing/ "Xirsys Signup")
* [Nodejs](https://nodejs.org/ "Nodejs Homepage") or PHP server
* Text editor like [Sublime Text](https://www.sublimetext.com/ "Sublime Text Homepage") or [Visual Studio Code](https://code.visualstudio.com/ "Visual Studio Code Homepage")

In order to secure your account credentials, its important to do the API calls from behind a protected server.  Our examples currently use a Nodejs or PHP server code for the examples.  You can signup for third party hosted services that have these technologies or for testing you can simply run them locally on your computer. 

## Setting up the examples for Nodejs

To setup the examples using Nodejs, first install the Nodejs server by downloading the software from the [Node.js](https://nodejs.org/ "Nodejs Homepage") website.  

Once Nodejs is installed in your system you can proceed to setting up the examples:

1.  Login to your Xirsys account and create a new **Channel** called **examples**. 
    * Copy the **Account Info** data in your account (ident, secret and channel).

    > For more info on creating channels see [Using the Portal](http://us.xirsys.com:9000/using-portal) doc.

2.  Open the **config** folder in the repository and edit **default.json** file in a text editor like [Sublime Text](https://www.sublimetext.com/).
    * In the default.json file paste what you copied from your account information into the default.json file respectively adding your ident into the ident value and secret into the secret value and so on, then save the file.

3.  Open a **Terminal** window or a **Window DOS Promp** and change your directory to the root of the repository where the **server.js** file is.
    * Install the dependancies using `npm install`.
    * After dependancies run the app using `npm start` or `node server`.
    * You should now see a message in the Terminal window telling you which port the nodejs app is lisenting to.  
    
4. Open your browser and type in the path to your node server (https://localhost:[port] if its running locally on your machine) with the port number its listening to. Your browser should resolve to an index page showing the links to each example in the repository.

    > NOTE:  The examples are currently using self signed certificates to temporarily satisfy the SSL requirement in WebRTC.  You should replace these with real certificate information if you want to use it in production.

