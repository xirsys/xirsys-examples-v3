// 'ident' and 'secret' should ideally be passed server-side for security purposes.
// If secureTokenRetrieval is true then you should remove these two values.

// Insecure method
var xirsysConnect = {
    secureTokenRetrieval: true,//true for server call, else false for local.
    server: '/webrtc',//Xirsys API call prefix for server
    data: {
        /* - unsecure
        ident: '',
        secret: '',
        channel: '',
        secure: 1*/
    }
};
