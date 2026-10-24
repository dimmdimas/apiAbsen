import mongoose from 'mongoose'

const connectDB = async () => {
    const url = 'mongodb://tomat:tomat@127.0.0.1:27017/?authSource=admin'
    try {
        await mongoose.connect(url, {
            dbName: 'absenlembur_gardira'
        })
        return Promise.resolve('Dtabase Connect')
    } catch (error) {
     return Promise.reject(error)   
    }
}

export default connectDB